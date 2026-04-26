from __future__ import annotations

from validators.validate_feedback_payload import validate_feedback_payload
from validators.validate_install_outcome import validate_install_outcome_payload


def _base_feedback(event_type: str, **extra: object) -> dict:
    return {
        "feedback_event_id": "fe_1",
        "recommendation_session_id": "sess_1",
        "project_id": "proj_1",
        "event_type": event_type,
        "event_source": "ios",
        **extra,
    }


def test_impression_omits_candidate_ok() -> None:
    r = validate_feedback_payload(
        _base_feedback("recommendation_impression", event_timestamp="2025-01-01T00:00:00Z"),
    )
    assert r.ok, r.errors


def test_select_without_candidate_warns() -> None:
    r = validate_feedback_payload(_base_feedback("recommendation_select"))
    assert not r.ok
    assert any("candidate_snapshot_id" in e for e in r.errors)


def test_candidate_selected_without_candidate_warns() -> None:
    r = validate_feedback_payload(_base_feedback("candidate_selected"))
    assert not r.ok


def test_select_with_candidate_ok() -> None:
    r = validate_feedback_payload(
        _base_feedback(
            "recommendation_select",
            candidate_snapshot_id="cand_1",
            event_timestamp="2025-01-01T00:00:00Z",
        ),
    )
    assert r.ok, r.errors


def test_invalid_event_type_rejected() -> None:
    r = validate_feedback_payload(_base_feedback("not_an_event"))
    assert not r.ok


def test_negative_dwell_rejected() -> None:
    r = validate_feedback_payload(
        _base_feedback(
            "recommendation_view",
            candidate_snapshot_id="c1",
            dwell_time_ms=-1,
        ),
    )
    assert not r.ok


def test_install_completed_requires_date() -> None:
    r = validate_install_outcome_payload(
        {"project_id": "p1", "install_status": "completed"},
    )
    assert not r.ok


def test_install_partial_real_world_ok() -> None:
    r = validate_install_outcome_payload(
        {
            "project_id": "p1",
            "install_status": "planned",
            "user_id": None,
            "telemetry_session_id": None,
        },
    )
    assert r.ok, r.errors


def test_survival_rate_range() -> None:
    r = validate_install_outcome_payload(
        {
            "project_id": "p1",
            "install_status": "completed",
            "install_date": "2025-06-01T00:00:00Z",
            "plant_survival_rate_30d": 1.5,
        },
    )
    assert not r.ok


def test_temp_cap() -> None:
    r = validate_install_outcome_payload(
        {
            "project_id": "p1",
            "install_status": "completed",
            "install_date": "2025-06-01T00:00:00Z",
            "measured_temp_change_c": 99,
        },
    )
    assert not r.ok
