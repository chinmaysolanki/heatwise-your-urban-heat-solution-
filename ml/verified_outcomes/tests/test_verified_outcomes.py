from __future__ import annotations

from verified_outcomes.mappers.outcome_label_mapper import build_verified_labels
from verified_outcomes.validators.validate_install_job import (
    can_transition,
    validate_install_job,
    validate_install_job_state,
)
from verified_outcomes.validators.validate_outcome_verification import validate_outcome_verification
from verified_outcomes.validators.validate_quote import validate_installer_quote
from verified_outcomes.validators.validate_verified_install import validate_verified_install


def test_quote_positive_amount() -> None:
    ok, errs = validate_installer_quote({"quote_amount_inr": 1000, "estimated_timeline_days": 14})
    assert ok and not errs


def test_quote_invalid_amount() -> None:
    ok, errs = validate_installer_quote({"quote_amount_inr": -1, "estimated_timeline_days": 14})
    assert not ok


def test_job_completed_requires_timestamp() -> None:
    ok, errs = validate_install_job_state("completed", {})
    assert not ok
    assert any("completed_at" in e for e in errs)


def test_job_transition() -> None:
    assert can_transition("scheduled", "in_progress")
    assert not can_transition("completed", "in_progress")


def test_validate_install_job_plan() -> None:
    ok, errs = validate_install_job({"job_status": "scheduled", "install_plan_json": {"steps": [1]}})
    assert ok, errs


def test_verified_install_match_conflict() -> None:
    ok, errs = validate_verified_install(
        {
            "matches_recommended_candidate": True,
            "mismatch_reason_codes_json": ["species_unavailable"],
            "installed_area_sqft": 100,
            "installer_confidence_score": 0.9,
        },
    )
    assert not ok


def test_verified_install_mismatch_requires_codes() -> None:
    ok, errs = validate_verified_install(
        {
            "matches_recommended_candidate": False,
            "mismatch_reason_codes_json": [],
            "installed_area_sqft": 100,
            "installer_confidence_score": 0.8,
        },
    )
    assert not ok


def test_outcome_tier() -> None:
    ok, errs = validate_outcome_verification(
        {"verification_confidence_tier": "high", "verification_window_days": 30},
    )
    assert ok


def test_outcome_bad_tier() -> None:
    ok, errs = validate_outcome_verification(
        {"verification_confidence_tier": "nope", "verification_window_days": 30},
    )
    assert not ok


def test_label_mapper() -> None:
    labels = build_verified_labels(
        job={"job_status": "completed", "finalCostInr": 100_000},
        verified_install={
            "id": "vi1",
            "matches_recommended_candidate": True,
            "mismatch_reason_codes_json": "[]",
            "installer_confidence_score": 0.9,
        },
        outcome={
            "verification_confidence_tier": "high",
            "measured_temp_change_c": -1.2,
            "user_satisfaction_score": 4.5,
        },
        quote={"quoteAmountInr": 100_000},
    )
    assert labels["verified_install_match_label"] is True
    assert labels["real_heat_mitigation_label"] >= 1
