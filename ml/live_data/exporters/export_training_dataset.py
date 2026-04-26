#!/usr/bin/env python3
"""
Build ML-oriented tables from exported feedback CSVs.

Event weights and canonical/legacy resolution are defined in
``telemetry_labeling.py`` and documented in ``EVENT_WEIGHTING.md`` (Phase 7).

**Post-install boost:** if ``install_outcomes`` has ``install_status=completed`` and
``selected_candidate_snapshot_id`` matches, add **+120** to that candidate's score.

**Pair generation:** for each session, for each ordered pair (a,b) where score_a > score_b,
emit ``preferred=a, other=b, preference_label=1``. Ties: no pair (conservative).

Exports ``live_feedback_events_enriched.csv`` with ``canonical_event`` and ``learning_weight``
for audit and offline joins.

This is weak supervision; refine weights from calibration on held-out explicit labels.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd

_LIVE_ROOT = Path(__file__).resolve().parent.parent
if str(_LIVE_ROOT) not in sys.path:
    sys.path.insert(0, str(_LIVE_ROOT))

from mappers.project_feature_mapper import map_project_features
from telemetry_labeling import (
    enrich_candidate_snapshots_species,
    enrich_feedback_events_dataframe,
    enrich_recommendation_sessions_run_id,
)


def _read_csv_optional(path: Path) -> pd.DataFrame:
    if not path.is_file():
        return pd.DataFrame()
    return pd.read_csv(path)


def _json_cell(r: pd.Series, *col_names: str) -> dict[str, Any]:
    for n in col_names:
        if n not in r.index or pd.isna(r[n]):
            continue
        raw = r[n]
        if isinstance(raw, str):
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return {}
        if isinstance(raw, dict):
            return raw
    return {}


def _session_project_features(sessions: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for _, r in sessions.iterrows():
        proj = _json_cell(r, "project_snapshot_json", "projectSnapshotJson")
        env = _json_cell(r, "environment_snapshot_json", "environmentSnapshotJson")
        pref = _json_cell(r, "preference_snapshot_json", "preferenceSnapshotJson")
        feats = map_project_features(proj, env, pref)
        feats["project_id"] = r.get("project_id", r.get("projectId"))
        feats["recommendation_session_id"] = r.get(
            "recommendation_session_id",
            r.get("recommendationSessionId", r.get("id")),
        )
        rows.append(feats)
    return pd.DataFrame(rows)


def _candidate_scores(events: pd.DataFrame, outcomes: pd.DataFrame) -> pd.DataFrame:
    """Per (session_id, candidate_snapshot_id) max event weight; apply install boost."""
    if events.empty:
        return pd.DataFrame(
            columns=[
                "recommendation_session_id",
                "candidate_snapshot_id",
                "heuristic_score",
                "recommendation_run_id",
            ],
        )

    events = events.copy()
    if "recommendation_session_id" not in events.columns and "sessionId" in events.columns:
        events = events.rename(columns={"sessionId": "recommendation_session_id"})
    if "candidate_snapshot_id" not in events.columns and "candidateSnapshotId" in events.columns:
        events = events.rename(columns={"candidateSnapshotId": "candidate_snapshot_id"})
    if "event_type" not in events.columns and "eventType" in events.columns:
        events = events.rename(columns={"eventType": "event_type"})
    if "learning_weight" not in events.columns:
        events = enrich_feedback_events_dataframe(events)
    events["w"] = events["learning_weight"]
    cand = events.dropna(subset=["candidate_snapshot_id"])
    if cand.empty:
        agg = pd.DataFrame(
            columns=["recommendation_session_id", "candidate_snapshot_id", "heuristic_score", "recommendation_run_id"],
        )
    else:
        gcols = ["recommendation_session_id", "candidate_snapshot_id"]
        agg = (
            cand.groupby(gcols, as_index=False)["w"]
            .max()
            .rename(columns={"w": "heuristic_score"})
        )
        if "recommendation_run_id" in cand.columns:
            rid = (
                cand.groupby(gcols)["recommendation_run_id"]
                .apply(lambda s: next((str(x) for x in s if pd.notna(x) and str(x).strip()), None))
                .reset_index(name="recommendation_run_id")
            )
            agg = agg.merge(rid, on=gcols, how="left")
        else:
            agg["recommendation_run_id"] = None

    if not outcomes.empty:
        oc = outcomes.copy()
        if "install_status" not in oc.columns and "installStatus" in oc.columns:
            oc = oc.rename(columns={"installStatus": "install_status"})
        if "selected_candidate_snapshot_id" not in oc.columns and "selectedCandidateSnapshotId" in oc.columns:
            oc = oc.rename(columns={"selectedCandidateSnapshotId": "selected_candidate_snapshot_id"})
        if "telemetry_session_id" not in oc.columns and "telemetrySessionId" in oc.columns:
            oc = oc.rename(columns={"telemetrySessionId": "telemetry_session_id"})
        if "install_status" not in oc.columns:
            done = pd.DataFrame()
        else:
            done = oc[oc["install_status"].astype(str) == "completed"]
        for _, o in done.iterrows():
            sid = o.get("telemetry_session_id") or o.get("recommendation_session_id")
            cid = o.get("selected_candidate_snapshot_id")
            if pd.isna(sid) or pd.isna(cid) or not cid:
                continue
            mask = (agg["recommendation_session_id"] == sid) & (agg["candidate_snapshot_id"] == cid)
            if mask.any():
                agg.loc[mask, "heuristic_score"] = agg.loc[mask, "heuristic_score"] + 120
            else:
                extra = {
                    "recommendation_session_id": sid,
                    "candidate_snapshot_id": cid,
                    "heuristic_score": 120.0,
                }
                if "recommendation_run_id" in agg.columns:
                    extra["recommendation_run_id"] = None
                agg = pd.concat([agg, pd.DataFrame([extra])], ignore_index=True)

    return agg


def _ranking_pairs(scores: pd.DataFrame) -> pd.DataFrame:
    cols = [
        "project_id",
        "recommendation_session_id",
        "preferred_candidate_id",
        "other_candidate_id",
        "preference_label",
        "heuristic_score_preferred",
        "heuristic_score_other",
    ]
    rows: list[dict[str, Any]] = []
    if scores.empty or "recommendation_session_id" not in scores.columns:
        return pd.DataFrame(columns=cols)
    for sid, g in scores.groupby("recommendation_session_id"):
        ids = g["candidate_snapshot_id"].tolist()
        sc = g["heuristic_score"].tolist()
        for i in range(len(ids)):
            for j in range(len(ids)):
                if sc[i] > sc[j]:
                    rows.append(
                        {
                            "project_id": "",
                            "recommendation_session_id": sid,
                            "preferred_candidate_id": ids[i],
                            "other_candidate_id": ids[j],
                            "preference_label": 1,
                            "heuristic_score_preferred": sc[i],
                            "heuristic_score_other": sc[j],
                        },
                    )
    if not rows:
        return pd.DataFrame(columns=cols)
    return pd.DataFrame(rows)


def build_training_exports(feedback_csv_dir: Path, output_dir: Path) -> dict[str, Path]:
    feedback_csv_dir = Path(feedback_csv_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    sessions = _read_csv_optional(feedback_csv_dir / "recommendation_sessions.csv")
    snaps = _read_csv_optional(feedback_csv_dir / "candidate_snapshots.csv")
    events = _read_csv_optional(feedback_csv_dir / "feedback_events.csv")
    outcomes = _read_csv_optional(feedback_csv_dir / "install_outcomes.csv")

    sessions = enrich_recommendation_sessions_run_id(sessions)
    snaps = enrich_candidate_snapshots_species(snaps)

    # Normalize session id column name
    if "recommendation_session_id" not in sessions.columns and "id" in sessions.columns:
        sessions = sessions.rename(columns={"id": "recommendation_session_id"})
    if "project_id" not in sessions.columns and "projectId" in sessions.columns:
        sessions = sessions.rename(columns={"projectId": "project_id"})

    if (
        "project_id" not in snaps.columns
        and not sessions.empty
        and "recommendation_session_id" in sessions.columns
        and "project_id" in sessions.columns
    ):
        sid_left = "sessionId" if "sessionId" in snaps.columns else "session_id"
        if sid_left in snaps.columns:
            snaps = snaps.merge(
                sessions[["recommendation_session_id", "project_id"]],
                left_on=sid_left,
                right_on="recommendation_session_id",
                how="left",
            )

    proj_feat = _session_project_features(sessions)
    p_out = output_dir / "live_project_features.csv"
    proj_feat.to_csv(p_out, index=False)

    cand_out = output_dir / "live_candidate_features.csv"
    snaps.to_csv(cand_out, index=False)

    events_enriched_path: Path | None = None
    events_for_scores = enrich_feedback_events_dataframe(events) if not events.empty else events
    if not events.empty:
        events_enriched_path = output_dir / "live_feedback_events_enriched.csv"
        events_for_scores.to_csv(events_enriched_path, index=False)

    scores = _candidate_scores(events_for_scores, outcomes)
    scores.to_csv(output_dir / "live_outcome_labels.csv", index=False)

    pairs = _ranking_pairs(scores)
    if (
        not sessions.empty
        and "recommendation_session_id" in sessions.columns
        and "project_id" in sessions.columns
    ):
        sid_to_pid = sessions.set_index("recommendation_session_id")["project_id"].to_dict()
    else:
        sid_to_pid = {}
    pairs["project_id"] = pairs["recommendation_session_id"].map(lambda s: sid_to_pid.get(s, ""))
    pairs.to_csv(output_dir / "live_ranking_pairs.csv", index=False)

    if snaps.empty and proj_feat.empty:
        joined = pd.DataFrame()
    elif proj_feat.empty:
        joined = snaps.copy()
    elif snaps.empty:
        joined = proj_feat.copy()
    else:
        joined = snaps.merge(proj_feat, on="project_id", how="left", suffixes=("", "_proj"))
    joined.to_csv(output_dir / "live_joined_training_table.csv", index=False)

    out: dict[str, Path] = {
        "live_project_features": p_out,
        "live_candidate_features": cand_out,
        "live_outcome_labels": output_dir / "live_outcome_labels.csv",
        "live_ranking_pairs": output_dir / "live_ranking_pairs.csv",
        "live_joined_training_table": output_dir / "live_joined_training_table.csv",
    }
    if events_enriched_path is not None:
        out["live_feedback_events_enriched"] = events_enriched_path
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Build live ML training CSVs from feedback export folder.")
    ap.add_argument("--feedback-csv-dir", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    args = ap.parse_args()
    paths = build_training_exports(args.feedback_csv_dir, args.output_dir)
    print(json.dumps({k: str(v) for k, v in paths.items()}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
