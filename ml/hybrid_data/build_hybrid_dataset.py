#!/usr/bin/env python3
"""
Assemble HeatWise hybrid training tables: synthetic bootstrap + live telemetry + outcomes.

Does not train models — only merges, tiers, weights, dedupe, and optional split filtering.
See label_policy.md and weighting_strategy.md for semantics.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd

HYBRID_ROOT = Path(__file__).resolve().parent
LIVE_ROOT = HYBRID_ROOT.parent / "live_data"

if str(LIVE_ROOT) not in sys.path:
    sys.path.insert(0, str(LIVE_ROOT))

from telemetry_labeling import enrich_feedback_events_dataframe  # noqa: E402

LABEL_POLICY_VERSION = "hw-hybrid-labels-v2"
WEIGHTING_POLICY_VERSION = "hw-hybrid-weights-v2"

BASE_WEIGHT: dict[str, float] = {
    "synthetic_heuristic": 0.35,
    "implicit_feedback_derived": 0.75,
    "explicit_feedback_derived": 1.20,
    "post_install_validated": 2.25,
}

EXPLICIT_EVENT_TYPES: frozenset[str] = frozenset(
    {
        "recommendation_select",
        "candidate_selected",
        "recommendation_save",
        "recommendation_unsave",
        "recommendation_feedback_positive",
        "candidate_rated_positive",
        "recommendation_feedback_negative",
        "candidate_rated_negative",
    },
)

POSITIVE_STRONG: frozenset[str] = frozenset(
    {
        "recommendation_select",
        "candidate_selected",
        "recommendation_save",
        "recommendation_feedback_positive",
        "candidate_rated_positive",
    },
)

NEGATIVE_STRONG: frozenset[str] = frozenset(
    {
        "recommendation_feedback_negative",
        "candidate_rated_negative",
        "recommendation_dismiss",
        "candidate_dismissed",
    },
)


def _read_csv(path: Path) -> pd.DataFrame:
    if not path.is_file():
        return pd.DataFrame()
    return pd.read_csv(path)


def _sha_record(data_source: str, project_id: str, candidate_key: str, session_id: str) -> str:
    raw = f"{data_source}|{project_id}|{candidate_key}|{session_id}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def _clip_weight(w: float) -> float:
    return float(max(0.05, min(5.0, w)))


def _norm_within_group(series: pd.Series, groups: pd.Series) -> pd.Series:
    def _norm(g: pd.Series) -> pd.Series:
        if len(g) <= 1 or g.nunique() == 1 or g.max() == g.min():
            return pd.Series(0.5, index=g.index)
        return (g - g.min()) / (g.max() - g.min())

    return series.groupby(groups, group_keys=False).transform(lambda g: _norm(g))


def _rename_live_events(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    out = df.copy()
    mapping = {
        "recommendationSessionId": "recommendation_session_id",
        "candidateSnapshotId": "candidate_snapshot_id",
        "eventType": "event_type",
    }
    for a, b in mapping.items():
        if b not in out.columns and a in out.columns:
            out = out.rename(columns={a: b})
    return out


def _rename_live_outcomes(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    out = df.copy()
    for a, b in (
        ("telemetrySessionId", "telemetry_session_id"),
        ("installStatus", "install_status"),
        ("selectedCandidateSnapshotId", "selected_candidate_snapshot_id"),
    ):
        if b not in out.columns and a in out.columns:
            out = out.rename(columns={a: b})
    return out


def _candidate_key_from_row(r: pd.Series) -> str:
    for k in ("candidate_snapshot_id", "candidateSnapshotId", "id", "candidate_id"):
        if k in r.index and pd.notna(r[k]) and str(r[k]).strip():
            return str(r[k]).strip()
    return ""


def _session_id_from_row(r: pd.Series) -> str:
    for k in ("recommendation_session_id", "recommendationSessionId", "sessionId", "session_id"):
        if k in r.index and pd.notna(r[k]) and str(r[k]).strip():
            return str(r[k]).strip()
    return ""


def _event_map(events: pd.DataFrame) -> dict[tuple[str, str], set[str]]:
    ev = _rename_live_events(events)
    if ev.empty or "recommendation_session_id" not in ev.columns:
        return {}
    if "canonical_event" not in ev.columns:
        ev = enrich_feedback_events_dataframe(ev)
    out: dict[tuple[str, str], set[str]] = defaultdict(set)
    for _, r in ev.iterrows():
        sid = r.get("recommendation_session_id")
        cid = r.get("candidate_snapshot_id")
        et = r.get("event_type")
        if pd.isna(sid) or pd.isna(cid):
            continue
        ce = r.get("canonical_event")
        if pd.isna(et) and pd.isna(ce):
            continue
        bucket = out[(str(sid), str(cid))]
        if pd.notna(et):
            bucket.add(str(et))
        if pd.notna(ce):
            bucket.add(str(ce))
    return dict(out)


def _install_by_session(outcomes: pd.DataFrame) -> dict[str, dict[str, Any]]:
    oc = _rename_live_outcomes(outcomes)
    m: dict[str, dict[str, Any]] = {}
    if oc.empty:
        return m
    for _, r in oc.iterrows():
        sid = r.get("telemetry_session_id")
        if pd.isna(sid) or sid is None:
            sid = r.get("recommendation_session_id")
        if pd.isna(sid):
            continue
        key = str(sid)
        m[key] = {
            "install_status": str(r.get("install_status", "")),
            "selected_candidate_snapshot_id": r.get("selected_candidate_snapshot_id"),
            "user_satisfaction_score": r.get("user_satisfaction_score"),
            "measured_temp_change_c": r.get("measured_temp_change_c"),
            "plant_survival_rate_90d": r.get("plant_survival_rate_90d"),
        }
    return m


def _live_tier_and_binary(
    session_id: str,
    candidate_key: str,
    ev_map: dict[tuple[str, str], set[str]],
    inst: dict[str, dict[str, Any]],
) -> tuple[str, Any, bool]:
    """Returns (tier, pointwise_binary int or pd.NA, had_logged_feedback)."""
    types_ = ev_map.get((session_id, candidate_key), set())
    had = len(types_) > 0
    meta = inst.get(session_id, {})
    st = meta.get("install_status", "")
    sel = meta.get("selected_candidate_snapshot_id")
    if st == "completed" and sel is not None and not pd.isna(sel) and str(sel) == str(candidate_key):
        return "post_install_validated", 1, had

    if types_ & EXPLICIT_EVENT_TYPES:
        tier = "explicit_feedback_derived"
        if types_ & POSITIVE_STRONG:
            return tier, 1, had
        if types_ & NEGATIVE_STRONG and not (types_ & POSITIVE_STRONG):
            return tier, 0, had
        return tier, pd.NA, had

    if had:
        return "implicit_feedback_derived", pd.NA, True
    return "implicit_feedback_derived", pd.NA, False


def _apply_weight_multipliers(
    tier: str,
    *,
    had_logged_feedback: bool,
    has_outcome_measurements: bool,
) -> float:
    w = BASE_WEIGHT[tier]
    if tier == "post_install_validated" and has_outcome_measurements:
        w *= 1.10
    if tier == "implicit_feedback_derived" and not had_logged_feedback:
        w *= 0.50
    return _clip_weight(w)


def _pair_tier_live(
    session_id: str,
    pref: str,
    other: str,
    ev_map: dict[tuple[str, str], set[str]],
    inst: dict[str, dict[str, Any]],
) -> str:
    meta = inst.get(session_id, {})
    if (
        meta.get("install_status") == "completed"
        and str(meta.get("selected_candidate_snapshot_id")) == str(pref)
    ):
        return "post_install_validated"
    u = ev_map.get((session_id, pref), set()) | ev_map.get((session_id, other), set())
    if u & EXPLICIT_EVENT_TYPES:
        return "explicit_feedback_derived"
    return "implicit_feedback_derived"


def _pair_weight(w_pref: float, w_other: float, pair_tier: str) -> float:
    g = math.sqrt(max(w_pref, 0.05) * max(w_other, 0.05))
    if pair_tier == "implicit_feedback_derived":
        g *= 0.85
    return _clip_weight(g)


@dataclass
class HybridBuildResult:
    paths: dict[str, Path] = field(default_factory=dict)
    manifest: dict[str, Any] = field(default_factory=dict)


def build_synthetic_pointwise(processed_dir: Path) -> pd.DataFrame:
    joined = _read_csv(processed_dir / "joined_training_table.csv")
    if joined.empty:
        return pd.DataFrame()
    if "project_id" not in joined.columns or "candidate_id" not in joined.columns:
        raise ValueError("synthetic joined_training_table must include project_id, candidate_id")

    joined = joined.reset_index(drop=True)
    score_col = "overall_recommendation_score" if "overall_recommendation_score" in joined.columns else None
    if score_col:
        rel = _norm_within_group(joined[score_col].astype(float), joined["project_id"]).reset_index(drop=True)
    else:
        rel = pd.Series(0.5, index=joined.index)

    bc = (joined["best_candidate"] if "best_candidate" in joined.columns else pd.Series(0, index=joined.index)).reset_index(
        drop=True,
    )
    lts = (
        joined["long_term_success_likelihood"]
        if "long_term_success_likelihood" in joined.columns
        else pd.Series(pd.NA, index=joined.index)
    ).reset_index(drop=True)

    rows: list[dict[str, Any]] = []
    for idx in range(len(joined)):
        r = joined.iloc[idx]
        pid = str(r["project_id"])
        cid = str(r["candidate_id"])
        tier = "synthetic_heuristic"
        w = _clip_weight(BASE_WEIGHT[tier])
        rows.append(
            {
                "record_id": _sha_record("synthetic_bootstrap", pid, cid, ""),
                "data_source": "synthetic_bootstrap",
                "label_confidence_tier": tier,
                "leakage_group_id": pid,
                "recommendation_session_id": pd.NA,
                "project_id": pid,
                "candidate_key": cid,
                "row_weight": w,
                "pointwise_relevance_score": float(rel.iloc[idx]),
                "pointwise_binary_relevant": int(bc.iloc[idx]) if pd.notna(bc.iloc[idx]) else pd.NA,
                "outcome_success_proxy": float(lts.iloc[idx]) if pd.notna(lts.iloc[idx]) else pd.NA,
                "had_logged_feedback": True,
                "label_policy_version": LABEL_POLICY_VERSION,
                "weighting_policy_version": WEIGHTING_POLICY_VERSION,
                "split": pd.NA,
            },
        )
    base = pd.DataFrame(rows)
    feat = joined.drop(columns=[c for c in joined.columns if c in base.columns], errors="ignore")
    out = pd.concat([base, feat.reset_index(drop=True)], axis=1)
    return out


def build_live_pointwise(
    live_joined: pd.DataFrame,
    heuristic_scores: pd.DataFrame,
    events: pd.DataFrame,
    outcomes: pd.DataFrame,
) -> pd.DataFrame:
    if live_joined.empty:
        return pd.DataFrame()
    ev_map = _event_map(events)
    inst = _install_by_session(outcomes)

    hs = heuristic_scores.copy()
    if not hs.empty:
        if "recommendation_session_id" not in hs.columns and "sessionId" in hs.columns:
            hs = hs.rename(columns={"sessionId": "recommendation_session_id"})
        if "candidate_snapshot_id" not in hs.columns and "candidateSnapshotId" in hs.columns:
            hs = hs.rename(columns={"candidateSnapshotId": "candidate_snapshot_id"})
        hs["_hkey"] = list(
            zip(hs["recommendation_session_id"].astype(str), hs["candidate_snapshot_id"].astype(str)),
        )
        score_lookup = dict(zip(hs["_hkey"], hs["heuristic_score"].astype(float)))
    else:
        score_lookup = {}

    lj = live_joined.copy().reset_index(drop=True)

    idx_rows: list[tuple[str, str, str]] = []
    for i in range(len(lj)):
        r = lj.iloc[i]
        ck = _candidate_key_from_row(r)
        sid = _session_id_from_row(r)
        if not ck or not sid:
            continue
        idx_rows.append((sid, ck, str(r.get("project_id", r.get("projectId", "")))))

    tmp_scores: dict[tuple[str, str], float] = {}
    for sid, ck, _ in idx_rows:
        tmp_scores[(sid, ck)] = float(score_lookup.get((sid, ck), 0.0))

    session_ids = list({sid for sid, _, _ in idx_rows})
    norm_rel: dict[tuple[str, str], float] = {}
    for s in session_ids:
        cands = [(ck, tmp_scores[(s, ck)]) for sid, ck, _ in idx_rows if sid == s]
        if not cands:
            continue
        vals = [v for _, v in cands]
        if len(vals) == 1 or max(vals) == min(vals):
            for ck, _ in cands:
                norm_rel[(s, ck)] = 0.5
        else:
            lo, hi = min(vals), max(vals)
            for ck, v in cands:
                norm_rel[(s, ck)] = (v - lo) / (hi - lo) if hi > lo else 0.5

    sel_idx: list[int] = []
    records: list[dict[str, Any]] = []
    for i in range(len(lj)):
        r = lj.iloc[i]
        ck = _candidate_key_from_row(r)
        sid = _session_id_from_row(r)
        if not ck or not sid:
            continue
        sel_idx.append(i)
        pid = str(r.get("project_id", r.get("projectId", "")))
        tier, binary, had = _live_tier_and_binary(sid, ck, ev_map, inst)
        meta = inst.get(sid, {})
        has_meas = any(
            pd.notna(meta.get(k))
            for k in ("user_satisfaction_score", "measured_temp_change_c", "plant_survival_rate_90d")
        )
        w = _apply_weight_multipliers(
            tier,
            had_logged_feedback=had,
            has_outcome_measurements=bool(has_meas and tier == "post_install_validated"),
        )
        rel = norm_rel.get((sid, ck), 0.5)
        leak = pid if pid and pid != "nan" else sid
        osp = pd.NA
        if tier == "post_install_validated":
            sat = meta.get("user_satisfaction_score")
            if pd.notna(sat):
                osp = float(sat)
        records.append(
            {
                "record_id": _sha_record("live_telemetry", leak, ck, sid),
                "data_source": "live_telemetry",
                "label_confidence_tier": tier,
                "leakage_group_id": leak,
                "recommendation_session_id": sid,
                "project_id": pid if pid and pid != "nan" else pd.NA,
                "candidate_key": ck,
                "row_weight": w,
                "pointwise_relevance_score": rel,
                "pointwise_binary_relevant": binary,
                "outcome_success_proxy": osp,
                "had_logged_feedback": had,
                "label_policy_version": LABEL_POLICY_VERSION,
                "weighting_policy_version": WEIGHTING_POLICY_VERSION,
                "split": pd.NA,
            },
        )

    base = pd.DataFrame(records)
    feat = lj.iloc[sel_idx].drop(columns=[c for c in lj.columns if c in base.columns], errors="ignore")
    return pd.concat([base.reset_index(drop=True), feat.reset_index(drop=True)], axis=1)


def build_synthetic_pairs(processed_dir: Path, weight_lookup: dict[tuple[str, str], float]) -> pd.DataFrame:
    pairs = _read_csv(processed_dir / "ranking_pairs.csv")
    if pairs.empty:
        return pd.DataFrame(
            columns=[
                "project_id",
                "preferred_candidate_id",
                "other_candidate_id",
                "preference_label",
                "data_source",
                "pair_confidence_tier",
                "row_weight",
                "leakage_group_id",
                "recommendation_session_id",
                "label_policy_version",
                "weighting_policy_version",
            ],
        )
    rows = []
    for _, r in pairs.iterrows():
        pid = str(r["project_id"])
        a, b = str(r["preferred_candidate_id"]), str(r["other_candidate_id"])
        w1 = weight_lookup.get((pid, a), BASE_WEIGHT["synthetic_heuristic"])
        w2 = weight_lookup.get((pid, b), BASE_WEIGHT["synthetic_heuristic"])
        ptier = "synthetic_heuristic"
        rows.append(
            {
                "project_id": pid,
                "preferred_candidate_id": a,
                "other_candidate_id": b,
                "preference_label": int(r.get("preference_label", 1)),
                "data_source": "synthetic_bootstrap",
                "pair_confidence_tier": ptier,
                "row_weight": _pair_weight(w1, w2, ptier),
                "leakage_group_id": pid,
                "recommendation_session_id": pd.NA,
                "label_policy_version": LABEL_POLICY_VERSION,
                "weighting_policy_version": WEIGHTING_POLICY_VERSION,
            },
        )
    return pd.DataFrame(rows)


def build_live_pairs(
    live_pairs: pd.DataFrame,
    weight_lookup: dict[tuple[str, str], float],
    ev_map: dict[tuple[str, str], set[str]],
    inst: dict[str, dict[str, Any]],
) -> pd.DataFrame:
    if live_pairs.empty:
        return pd.DataFrame()
    lp = live_pairs.copy()
    if "recommendation_session_id" not in lp.columns and "recommendationSessionId" in lp.columns:
        lp = lp.rename(columns={"recommendationSessionId": "recommendation_session_id"})
    rows = []
    for _, r in lp.iterrows():
        sid = str(r.get("recommendation_session_id", ""))
        pid = str(r.get("project_id", ""))
        a = str(r.get("preferred_candidate_id", r.get("preferredCandidateId", "")))
        b = str(r.get("other_candidate_id", r.get("otherCandidateId", "")))
        if not sid or not a or not b:
            continue
        ptier = _pair_tier_live(sid, a, b, ev_map, inst)
        w1 = weight_lookup.get((sid, a), BASE_WEIGHT["implicit_feedback_derived"])
        w2 = weight_lookup.get((sid, b), BASE_WEIGHT["implicit_feedback_derived"])
        rows.append(
            {
                "project_id": pid,
                "preferred_candidate_id": a,
                "other_candidate_id": b,
                "preference_label": int(r.get("preference_label", 1)),
                "data_source": "live_telemetry",
                "pair_confidence_tier": ptier,
                "row_weight": _pair_weight(w1, w2, ptier),
                "leakage_group_id": pid if pid and pid != "nan" else sid,
                "recommendation_session_id": sid,
                "label_policy_version": LABEL_POLICY_VERSION,
                "weighting_policy_version": WEIGHTING_POLICY_VERSION,
            },
        )
    return pd.DataFrame(rows)


def build_outcome_table(
    synthetic_joined: pd.DataFrame,
    outcomes: pd.DataFrame,
) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    if not synthetic_joined.empty and "best_candidate" in synthetic_joined.columns:
        best = synthetic_joined[synthetic_joined["best_candidate"] == 1]
        for _, r in best.iterrows():
            pid = str(r["project_id"])
            cid = str(r["candidate_id"])
            lts = r.get("long_term_success_likelihood")
            rows.append(
                {
                    "outcome_record_id": _sha_record("outcome_synth", pid, cid, ""),
                    "data_source": "synthetic_bootstrap",
                    "label_confidence_tier": "synthetic_heuristic",
                    "leakage_group_id": pid,
                    "project_id": pid,
                    "candidate_key": cid,
                    "recommendation_session_id": pd.NA,
                    "target_user_satisfaction": pd.NA,
                    "target_temp_change_c": pd.NA,
                    "target_survival_90d": pd.NA,
                    "target_long_term_success": float(lts) if pd.notna(lts) else pd.NA,
                    "row_weight": _clip_weight(BASE_WEIGHT["synthetic_heuristic"] * 0.6),
                    "label_policy_version": LABEL_POLICY_VERSION,
                    "weighting_policy_version": WEIGHTING_POLICY_VERSION,
                },
            )

    oc = _rename_live_outcomes(outcomes)
    for _, r in oc.iterrows():
        pid = str(r.get("project_id", ""))
        sid = r.get("telemetry_session_id") or r.get("recommendation_session_id")
        cid = r.get("selected_candidate_snapshot_id")
        st = str(r.get("install_status", ""))
        tier = "post_install_validated" if st == "completed" else "implicit_feedback_derived"
        has_meas = any(pd.notna(r.get(k)) for k in ("user_satisfaction_score", "measured_temp_change_c", "plant_survival_rate_90d"))
        w = _apply_weight_multipliers(
            tier,
            had_logged_feedback=True,
            has_outcome_measurements=bool(has_meas and tier == "post_install_validated"),
        )
        ck = str(cid) if pd.notna(cid) else ""
        rows.append(
            {
                "outcome_record_id": _sha_record("outcome_live", pid, ck, str(sid or "")),
                "data_source": "live_telemetry",
                "label_confidence_tier": tier,
                "leakage_group_id": pid if pid and pid != "nan" else str(sid),
                "project_id": pid if pid else pd.NA,
                "candidate_key": ck if ck else pd.NA,
                "recommendation_session_id": str(sid) if pd.notna(sid) else pd.NA,
                "target_user_satisfaction": r.get("user_satisfaction_score"),
                "target_temp_change_c": r.get("measured_temp_change_c"),
                "target_survival_90d": r.get("plant_survival_rate_90d"),
                "target_long_term_success": pd.NA,
                "row_weight": w,
                "label_policy_version": LABEL_POLICY_VERSION,
                "weighting_policy_version": WEIGHTING_POLICY_VERSION,
            },
        )

    out_df = pd.DataFrame(rows)
    if not out_df.empty and "outcome_record_id" in out_df.columns:
        out_df = out_df.drop_duplicates(subset=["outcome_record_id"], keep="first")
    return out_df


def _dedupe_pointwise(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    return df.drop_duplicates(subset=["record_id"], keep="first")


def _dedupe_pairs(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    subset = [
        "data_source",
        "project_id",
        "preferred_candidate_id",
        "other_candidate_id",
        "recommendation_session_id",
    ]
    cols = [c for c in subset if c in df.columns]
    return df.drop_duplicates(subset=cols, keep="first")


def _split_manifest_merge(df: pd.DataFrame, manifest_path: Path) -> pd.DataFrame:
    sm = _read_csv(manifest_path)
    if sm.empty or "split" not in sm.columns:
        return df
    key = "leakage_group_id" if "leakage_group_id" in sm.columns else sm.columns[0]
    m = sm[[key, "split"]].drop_duplicates()
    if key == "leakage_group_id":
        return df.drop(columns=["split"], errors="ignore").merge(m, on="leakage_group_id", how="left")
    out = df.drop(columns=["split"], errors="ignore").merge(m, left_on="leakage_group_id", right_on=key, how="left")
    if key in out.columns and key != "leakage_group_id":
        out = out.drop(columns=[key], errors="ignore")
    return out


def build_hybrid_dataset(
    *,
    synthetic_processed_dir: Path | None = None,
    live_feedback_csv_dir: Path | None = None,
    live_training_dir: Path | None = None,
    output_dir: Path,
    split_manifest: Path | None = None,
    split_filter: str | None = None,
    rebuild_live_training: bool = False,
) -> HybridBuildResult:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    warnings: list[str] = []

    live_train_dir = Path(live_training_dir) if live_training_dir else output_dir / "_live_training_cache"
    events = pd.DataFrame()
    outcomes = pd.DataFrame()

    if live_feedback_csv_dir:
        lf = Path(live_feedback_csv_dir)
        events = _read_csv(lf / "feedback_events.csv")
        if not events.empty:
            events = enrich_feedback_events_dataframe(events)
        outcomes = _read_csv(lf / "install_outcomes.csv")
        need_rebuild = rebuild_live_training or not (live_train_dir / "live_joined_training_table.csv").is_file()
        if need_rebuild and lf.is_dir():
            if str(LIVE_ROOT) not in sys.path:
                sys.path.insert(0, str(LIVE_ROOT))
            from exporters.export_training_dataset import build_training_exports

            build_training_exports(lf, live_train_dir)

    live_joined = _read_csv(live_train_dir / "live_joined_training_table.csv")
    heuristic = _read_csv(live_train_dir / "live_outcome_labels.csv")
    live_pairs_csv = _read_csv(live_train_dir / "live_ranking_pairs.csv")

    synth_point = pd.DataFrame()
    synth_dir = Path(synthetic_processed_dir) if synthetic_processed_dir else None
    if synth_dir and (synth_dir / "joined_training_table.csv").is_file():
        synth_point = build_synthetic_pointwise(synth_dir)

    live_point = build_live_pointwise(live_joined, heuristic, events, outcomes)

    if not synth_point.empty and not live_point.empty:
        sp_ids = set(synth_point["project_id"].astype(str).unique())
        lp_ids = set(live_point["project_id"].dropna().astype(str).unique())
        collision = sp_ids & lp_ids
        if collision:
            warnings.append(f"project_id collision between synthetic and live (sample): {sorted(collision)[:20]}")

    point = pd.concat([synth_point, live_point], ignore_index=True)
    point = _dedupe_pointwise(point)

    w_lookup_synth: dict[tuple[str, str], float] = {}
    for _, r in synth_point.iterrows():
        w_lookup_synth[(str(r["project_id"]), str(r["candidate_key"]))] = float(r["row_weight"])
    w_lookup_live: dict[tuple[str, str], float] = {}
    for _, r in live_point.iterrows():
        sid = r.get("recommendation_session_id")
        if pd.notna(sid):
            w_lookup_live[(str(sid), str(r["candidate_key"]))] = float(r["row_weight"])

    synth_pairs_df = pd.DataFrame()
    if synth_dir and (synth_dir / "ranking_pairs.csv").is_file():
        synth_pairs_df = build_synthetic_pairs(synth_dir, w_lookup_synth)

    ev_map = _event_map(events)
    inst = _install_by_session(outcomes)
    live_pairs_df = build_live_pairs(live_pairs_csv, w_lookup_live, ev_map, inst)
    pairs = pd.concat([synth_pairs_df, live_pairs_df], ignore_index=True)
    pairs = _dedupe_pairs(pairs)

    synth_joined = _read_csv(synth_dir / "joined_training_table.csv") if synth_dir else pd.DataFrame()
    outcomes_tbl = build_outcome_table(synth_joined, outcomes)

    if split_manifest and split_manifest.is_file():
        point = _split_manifest_merge(point, split_manifest)
        pairs = _split_manifest_merge(pairs, split_manifest)
    if split_filter and "split" in point.columns:
        point = point[point["split"].astype(str) == split_filter]
    if split_filter and "split" in pairs.columns:
        pairs = pairs[pairs["split"].astype(str) == split_filter]

    p_point = output_dir / "hybrid_pointwise.csv"
    p_pairs = output_dir / "hybrid_ranking_pairs.csv"
    p_out = output_dir / "hybrid_outcome_rows.csv"
    point.to_csv(p_point, index=False)
    pairs.to_csv(p_pairs, index=False)
    outcomes_tbl.to_csv(p_out, index=False)

    manifest = {
        "label_policy_version": LABEL_POLICY_VERSION,
        "weighting_policy_version": WEIGHTING_POLICY_VERSION,
        "rows_pointwise": len(point),
        "rows_pairs": len(pairs),
        "rows_outcomes": len(outcomes_tbl),
        "warnings": warnings,
        "synthetic_processed_dir": str(synthetic_processed_dir) if synthetic_processed_dir else None,
        "live_feedback_csv_dir": str(live_feedback_csv_dir) if live_feedback_csv_dir else None,
        "split_filter": split_filter,
    }
    (output_dir / "hybrid_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    return HybridBuildResult(
        paths={"pointwise": p_point, "pairs": p_pairs, "outcomes": p_out},
        manifest=manifest,
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Build HeatWise hybrid ML dataset tables.")
    ap.add_argument("--synthetic-processed-dir", type=Path, default=None, help="Bootstrap processed/ with joined + ranking_pairs")
    ap.add_argument("--live-feedback-csv-dir", type=Path, default=None, help="Live export_feedback_dataset CSV folder")
    ap.add_argument("--live-training-dir", type=Path, default=None, help="Optional cache of live export_training outputs")
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--split-manifest", type=Path, default=None, help="CSV: leakage_group_id (or project_id), split")
    ap.add_argument("--split-filter", type=str, default=None, choices=["train", "val", "test"])
    ap.add_argument("--rebuild-live-training", action="store_true")
    args = ap.parse_args()
    res = build_hybrid_dataset(
        synthetic_processed_dir=args.synthetic_processed_dir,
        live_feedback_csv_dir=args.live_feedback_csv_dir,
        live_training_dir=args.live_training_dir,
        output_dir=args.output_dir,
        split_manifest=args.split_manifest,
        split_filter=args.split_filter,
        rebuild_live_training=args.rebuild_live_training,
    )
    print(json.dumps({k: str(v) for k, v in res.paths.items()}, indent=2))
    print(json.dumps(res.manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
