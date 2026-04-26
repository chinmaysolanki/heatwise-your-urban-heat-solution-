from __future__ import annotations

from longitudinal_tracking.exporters.export_longitudinal_labels import build_labels_for_schedule, run
from longitudinal_tracking.validators.validate_followup import (
    validate_checkpoint_transition,
    validate_followup_event,
    validate_schedule_offsets,
)
from longitudinal_tracking.validators.validate_remeasurement import validate_remeasurement_row


def test_offsets() -> None:
    ok, _ = validate_schedule_offsets([7, 30])
    assert ok
    ok, _ = validate_schedule_offsets([7, 7])
    assert not ok
    ok, _ = validate_schedule_offsets([5])
    assert not ok


def test_followup_event_reschedule_metadata() -> None:
    ok, errs = validate_followup_event({"event_type": "rescheduled", "checkpoint_id": "c1"})
    assert not ok
    assert errs
    ok, errs = validate_followup_event(
        {
            "event_type": "rescheduled",
            "checkpoint_id": "c1",
            "metadata_json": {"new_due_at": "2026-01-01T00:00:00Z"},
        },
    )
    assert ok


def test_checkpoint_transition() -> None:
    assert validate_checkpoint_transition("pending", "completed")
    assert not validate_checkpoint_transition("completed", "pending")


def test_remeasurement_ranges() -> None:
    ok, errs = validate_remeasurement_row({"window_label": "30d", "plant_survival_rate": 1.5})
    assert not ok
    ok, errs = validate_remeasurement_row({"window_label": "30d", "plant_survival_rate": 0.9})
    assert ok


def test_build_labels_delayed_failure() -> None:
    by_sched_remeas = [
        {"windowLabel": "30d", "plantSurvivalRate": 0.9, "measuredAt": "2026-02-01T00:00:00Z"},
        {"windowLabel": "90d", "plantSurvivalRate": 0.4, "measuredAt": "2026-04-01T00:00:00Z"},
    ]
    row = build_labels_for_schedule("s1", "p1", by_sched_remeas)
    assert row["delayed_failure_indicator"] is True
    assert row["survival_trend"] == "declining"


def test_export_run(tmp_path) -> None:
    bundle = {
        "schedules": [{"id": "sch1", "projectId": "p1"}],
        "remeasurements": [
            {
                "scheduleId": "sch1",
                "projectId": "p1",
                "windowLabel": "7d",
                "plantSurvivalRate": 0.95,
                "heatMitigationStabilityScore": 0.8,
                "measuredAt": "2026-01-08T00:00:00Z",
            },
            {
                "scheduleId": "sch1",
                "projectId": "p1",
                "windowLabel": "30d",
                "plantSurvivalRate": 0.92,
                "heatMitigationStabilityScore": 0.78,
                "measuredAt": "2026-01-31T00:00:00Z",
            },
        ],
    }
    run(bundle, tmp_path)
    assert (tmp_path / "longitudinal_training_labels.csv").exists()
