from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from exporters.export_feedback_dataset import export_feedback_tables
from exporters.export_training_dataset import build_training_exports


def test_feedback_export_writes_csvs_and_aggregates(tmp_path: Path) -> None:
    ind = tmp_path / "in"
    ind.mkdir()
    out = tmp_path / "out"
    (ind / "recommendation_sessions.jsonl").write_text(
        json.dumps(
            {
                "recommendation_session_id": "s1",
                "project_id": "p1",
                "project_snapshot_json": "{}",
                "environment_snapshot_json": "{}",
                "preference_snapshot_json": "{}",
            },
        )
        + "\n",
        encoding="utf-8",
    )
    (ind / "candidate_snapshots.jsonl").write_text(
        json.dumps(
            {
                "candidate_snapshot_id": "c1",
                "sessionId": "s1",
                "project_id": "p1",
                "candidate_rank": 1,
            },
        )
        + "\n",
        encoding="utf-8",
    )
    (ind / "feedback_events.jsonl").write_text(
        json.dumps(
            {
                "recommendation_session_id": "s1",
                "candidate_snapshot_id": "c1",
                "event_type": "recommendation_view",
                "dwell_time_ms": 500,
            },
        )
        + "\n",
        encoding="utf-8",
    )
    paths = export_feedback_tables(ind, out)
    assert "recommendation_sessions" in paths
    assert (out / "implicit_signal_aggregates.csv").is_file()
    agg = pd.read_csv(out / "implicit_signal_aggregates.csv")
    assert len(agg) == 1
    assert int(agg.iloc[0]["dwell_time_ms"]) == 500


def test_training_export_canonical_event_and_legacy_metadata_weight(tmp_path: Path) -> None:
    """Phase 7: metadata.legacyEventType preserves regenerate penalty vs dismiss umbrella."""
    from telemetry_labeling import event_weight_for_row
    assert event_weight_for_row(
        "candidate_dismissed",
        '{"legacyEventType":"recommendation_request_regenerate"}',
    ) == pytest.approx(-20.0)
    assert event_weight_for_row(
        "recommendation_impression",
        '{"canonicalEvent":"candidate_viewed"}',
    ) == pytest.approx(10.0)


def test_training_export_ranking_pairs(tmp_path: Path) -> None:
    fb = tmp_path / "fb"
    fb.mkdir()
    ml = tmp_path / "ml"
    pd.DataFrame(
        [
            {
                "recommendation_session_id": "s1",
                "project_id": "p1",
                "project_snapshot_json": '{"area_sqft": 100}',
                "environment_snapshot_json": "{}",
                "preference_snapshot_json": "{}",
            },
        ],
    ).to_csv(fb / "recommendation_sessions.csv", index=False)
    pd.DataFrame(
        [
            {
                "candidate_snapshot_id": "c_hi",
                "sessionId": "s1",
                "project_id": "p1",
                "candidate_rank": 1,
            },
            {
                "candidate_snapshot_id": "c_lo",
                "sessionId": "s1",
                "project_id": "p1",
                "candidate_rank": 2,
            },
        ],
    ).to_csv(fb / "candidate_snapshots.csv", index=False)
    pd.DataFrame(
        [
            {
                "recommendation_session_id": "s1",
                "candidate_snapshot_id": "c_hi",
                "event_type": "recommendation_select",
            },
            {
                "recommendation_session_id": "s1",
                "candidate_snapshot_id": "c_lo",
                "event_type": "recommendation_impression",
            },
        ],
    ).to_csv(fb / "feedback_events.csv", index=False)
    pd.DataFrame(
        [
            {
                "project_id": "p1",
                "telemetry_session_id": "s1",
                "selected_candidate_snapshot_id": "c_hi",
                "install_status": "completed",
                "install_date": "2025-01-02T00:00:00Z",
            },
        ],
    ).to_csv(fb / "install_outcomes.csv", index=False)

    paths = build_training_exports(fb, ml)
    pairs = pd.read_csv(paths["live_ranking_pairs"])
    assert not pairs.empty
    row = pairs.iloc[0]
    assert row["preferred_candidate_id"] == "c_hi"
    assert row["other_candidate_id"] == "c_lo"
    assert row["project_id"] == "p1"
    assert "live_feedback_events_enriched" in paths
    enriched = pd.read_csv(paths["live_feedback_events_enriched"])
    assert "canonical_event" in enriched.columns
    assert "learning_weight" in enriched.columns


def test_training_export_ranking_pairs_canonical_selected(tmp_path: Path) -> None:
    fb = tmp_path / "fb2"
    fb.mkdir()
    ml = tmp_path / "ml2"
    pd.DataFrame(
        [
            {
                "recommendation_session_id": "s2",
                "project_id": "p2",
                "project_snapshot_json": "{}",
                "environment_snapshot_json": "{}",
                "preference_snapshot_json": "{}",
            },
        ],
    ).to_csv(fb / "recommendation_sessions.csv", index=False)
    pd.DataFrame(
        [
            {"candidate_snapshot_id": "c_a", "sessionId": "s2", "project_id": "p2", "candidate_rank": 1},
            {"candidate_snapshot_id": "c_b", "sessionId": "s2", "project_id": "p2", "candidate_rank": 2},
        ],
    ).to_csv(fb / "candidate_snapshots.csv", index=False)
    pd.DataFrame(
        [
            {
                "recommendation_session_id": "s2",
                "candidate_snapshot_id": "c_a",
                "event_type": "candidate_selected",
                "metadata_json": '{"legacyEventType":"recommendation_select"}',
            },
            {"recommendation_session_id": "s2", "candidate_snapshot_id": "c_b", "event_type": "candidate_viewed"},
        ],
    ).to_csv(fb / "feedback_events.csv", index=False)
    pd.DataFrame(
        columns=["project_id", "telemetry_session_id", "selected_candidate_snapshot_id", "install_status"],
    ).to_csv(fb / "install_outcomes.csv", index=False)
    paths = build_training_exports(fb, ml)
    labels = pd.read_csv(paths["live_outcome_labels"])
    hi = labels[labels["candidate_snapshot_id"] == "c_a"].iloc[0]
    lo = labels[labels["candidate_snapshot_id"] == "c_b"].iloc[0]
    assert float(hi["heuristic_score"]) > float(lo["heuristic_score"])


def test_training_export_empty_inputs_no_crash(tmp_path: Path) -> None:
    fb = tmp_path / "fb"
    fb.mkdir()
    ml = tmp_path / "ml"
    build_training_exports(fb, ml)
    assert (ml / "live_joined_training_table.csv").is_file()
