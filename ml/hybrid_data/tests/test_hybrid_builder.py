from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest
from jsonschema import Draft202012Validator

from build_hybrid_dataset import (
    BASE_WEIGHT,
    LABEL_POLICY_VERSION,
    WEIGHTING_POLICY_VERSION,
    build_hybrid_dataset,
    build_synthetic_pointwise,
)


def _schema_validator() -> Draft202012Validator:
    root = Path(__file__).resolve().parent.parent / "schemas" / "hybrid_training_schema.json"
    spec = json.loads(root.read_text(encoding="utf-8"))
    return Draft202012Validator(spec)


def test_synthetic_pointwise_provenance_and_weight(tmp_path: Path) -> None:
    proc = tmp_path / "processed"
    proc.mkdir()
    joined = pd.DataFrame(
        [
            {
                "project_id": "PRJ-000001-000000",
                "candidate_id": "PRJ-000001-000000-C00",
                "overall_recommendation_score": 0.9,
                "best_candidate": 1,
                "long_term_success_likelihood": 0.7,
                "area_sqft": 100.0,
            },
            {
                "project_id": "PRJ-000001-000000",
                "candidate_id": "PRJ-000001-000000-C01",
                "overall_recommendation_score": 0.4,
                "best_candidate": 0,
                "long_term_success_likelihood": 0.5,
                "area_sqft": 100.0,
            },
        ],
    )
    joined.to_csv(proc / "joined_training_table.csv", index=False)
    pd.DataFrame(
        [
            {
                "project_id": "PRJ-000001-000000",
                "preferred_candidate_id": "PRJ-000001-000000-C00",
                "other_candidate_id": "PRJ-000001-000000-C01",
                "preference_label": 1,
            },
        ],
    ).to_csv(proc / "ranking_pairs.csv", index=False)

    df = build_synthetic_pointwise(proc)
    assert len(df) == 2
    assert set(df["data_source"].unique()) == {"synthetic_bootstrap"}
    assert set(df["label_confidence_tier"].unique()) == {"synthetic_heuristic"}
    assert df["row_weight"].iloc[0] == pytest.approx(BASE_WEIGHT["synthetic_heuristic"])
    assert df["pointwise_relevance_score"].max() >= df["pointwise_relevance_score"].min()
    v = _schema_validator()
    for _, r in df.iterrows():
        rec = {
            "record_id": r["record_id"],
            "data_source": r["data_source"],
            "label_confidence_tier": r["label_confidence_tier"],
            "leakage_group_id": r["leakage_group_id"],
            "candidate_key": r["candidate_key"],
            "row_weight": float(r["row_weight"]),
            "label_policy_version": r["label_policy_version"],
            "weighting_policy_version": r["weighting_policy_version"],
            "recommendation_session_id": None,
            "pointwise_relevance_score": float(r["pointwise_relevance_score"]),
            "pointwise_binary_relevant": int(r["pointwise_binary_relevant"]),
            "outcome_success_proxy": None,
            "had_logged_feedback": True,
            "split": None,
        }
        errs = list(v.iter_errors(rec))
        assert not errs, errs


def test_hybrid_end_to_end_with_live(tmp_path: Path) -> None:
    proc = tmp_path / "processed"
    proc.mkdir()
    joined = pd.DataFrame(
        [
            {
                "project_id": "PRJ-S",
                "candidate_id": "PRJ-S-C0",
                "overall_recommendation_score": 0.8,
                "best_candidate": 1,
                "long_term_success_likelihood": 0.6,
            },
        ],
    )
    joined.to_csv(proc / "joined_training_table.csv", index=False)
    pd.DataFrame(
        [
            {
                "project_id": "PRJ-S",
                "preferred_candidate_id": "PRJ-S-C0",
                "other_candidate_id": "PRJ-S-C1",
                "preference_label": 1,
            },
        ],
    ).to_csv(proc / "ranking_pairs.csv", index=False)

    live = tmp_path / "live_csv"
    live.mkdir()
    (live / "recommendation_sessions.jsonl").write_text(
        json.dumps(
            {
                "recommendation_session_id": "sess1",
                "project_id": "proj_live",
                "project_snapshot_json": "{}",
                "environment_snapshot_json": "{}",
                "preference_snapshot_json": "{}",
            },
        )
        + "\n",
        encoding="utf-8",
    )
    with (live / "candidate_snapshots.jsonl").open("w", encoding="utf-8") as f:
        f.write(
            json.dumps(
                {
                    "candidate_snapshot_id": "cand_hi",
                    "sessionId": "sess1",
                    "project_id": "proj_live",
                    "candidate_rank": 1,
                },
            )
            + "\n",
        )
        f.write(
            json.dumps(
                {
                    "candidate_snapshot_id": "cand_lo",
                    "sessionId": "sess1",
                    "project_id": "proj_live",
                    "candidate_rank": 2,
                },
            )
            + "\n",
        )
    (live / "feedback_events.jsonl").write_text(
        json.dumps(
            {
                "feedback_event_id": "e1",
                "recommendation_session_id": "sess1",
                "project_id": "proj_live",
                "candidate_snapshot_id": "cand_hi",
                "event_type": "recommendation_select",
                "event_source": "ios",
                "event_timestamp": "2025-01-01T00:00:00Z",
            },
        )
        + "\n",
        encoding="utf-8",
    )
    (live / "install_outcomes.jsonl").write_text(
        json.dumps(
            {
                "project_id": "proj_live",
                "telemetry_session_id": "sess1",
                "selected_candidate_snapshot_id": "cand_hi",
                "install_status": "completed",
                "install_date": "2025-02-01T00:00:00Z",
                "user_satisfaction_score": 0.9,
            },
        )
        + "\n",
        encoding="utf-8",
    )

    # JSONL -> CSV for live_data exporters
    import subprocess
    import sys

    live_data = Path(__file__).resolve().parent.parent.parent / "live_data"
    subprocess.run(
        [
            sys.executable,
            str(live_data / "exporters" / "export_feedback_dataset.py"),
            "--input-dir",
            str(live),
            "--output-dir",
            str(live / "csv"),
        ],
        check=True,
    )

    out = tmp_path / "hybrid_out"
    res = build_hybrid_dataset(
        synthetic_processed_dir=proc,
        live_feedback_csv_dir=live / "csv",
        live_training_dir=tmp_path / "live_train",
        output_dir=out,
        rebuild_live_training=True,
    )

    point = pd.read_csv(res.paths["pointwise"])
    assert "synthetic_bootstrap" in point["data_source"].values
    assert "live_telemetry" in point["data_source"].values
    live_rows = point[point["data_source"] == "live_telemetry"]
    assert (live_rows["label_confidence_tier"] == "post_install_validated").any()

    pairs = pd.read_csv(res.paths["pairs"])
    assert len(pairs) >= 1
    assert "pair_confidence_tier" in pairs.columns

    oc = pd.read_csv(res.paths["outcomes"])
    assert len(oc) >= 2

    assert res.manifest["label_policy_version"] == LABEL_POLICY_VERSION
    assert res.manifest["weighting_policy_version"] == WEIGHTING_POLICY_VERSION


def test_dedupe_record_id_pointwise(tmp_path: Path) -> None:
    proc = tmp_path / "processed"
    proc.mkdir()
    joined = pd.DataFrame(
        [
            {
                "project_id": "P",
                "candidate_id": "C",
                "overall_recommendation_score": 0.5,
                "best_candidate": 1,
            },
        ],
    )
    joined.to_csv(proc / "joined_training_table.csv", index=False)
    pd.DataFrame(
        [{"project_id": "P", "preferred_candidate_id": "C", "other_candidate_id": "D", "preference_label": 1}],
    ).to_csv(proc / "ranking_pairs.csv", index=False)

    out = tmp_path / "o"
    res = build_hybrid_dataset(
        synthetic_processed_dir=proc,
        live_feedback_csv_dir=None,
        live_training_dir=None,
        output_dir=out,
    )
    point = pd.read_csv(res.paths["pointwise"])
    assert point["record_id"].nunique() == len(point)


def test_split_manifest_filter(tmp_path: Path) -> None:
    proc = tmp_path / "processed"
    proc.mkdir()
    joined = pd.DataFrame(
        [
            {
                "project_id": "P_TRAIN",
                "candidate_id": "C1",
                "overall_recommendation_score": 0.5,
                "best_candidate": 1,
            },
        ],
    )
    joined.to_csv(proc / "joined_training_table.csv", index=False)
    pd.DataFrame(
        [{"project_id": "P_TRAIN", "preferred_candidate_id": "C1", "other_candidate_id": "C2", "preference_label": 1}],
    ).to_csv(proc / "ranking_pairs.csv", index=False)

    man = tmp_path / "manifest.csv"
    pd.DataFrame([{"leakage_group_id": "P_TRAIN", "split": "train"}]).to_csv(man, index=False)
    out = tmp_path / "o2"
    res = build_hybrid_dataset(
        synthetic_processed_dir=proc,
        live_feedback_csv_dir=None,
        output_dir=out,
        split_manifest=man,
        split_filter="train",
    )
    point = pd.read_csv(res.paths["pointwise"])
    assert len(point) == 1
    assert point.iloc[0]["split"] == "train"
