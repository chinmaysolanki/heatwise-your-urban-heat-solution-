from __future__ import annotations

from validators.validate_project_payload import (
    duplicate_event_protection_hook,
    validate_project_ingestion_payload,
    validate_recommendation_session_payload,
)


def test_project_ingestion_accepts_minimal() -> None:
    payload = {
        "project_snapshot": {"area_sqft": 120},
        "environment_snapshot": {},
        "preference_snapshot": {},
    }
    r = validate_project_ingestion_payload(payload)
    assert r.ok, r.errors


def test_project_ingestion_rejects_empty_project_snapshot() -> None:
    payload = {
        "project_snapshot": {},
        "environment_snapshot": {},
        "preference_snapshot": {},
    }
    r = validate_project_ingestion_payload(payload)
    assert not r.ok


def test_session_payload_accepts_valid() -> None:
    payload = {
        "project_id": "proj_1",
        "model_version": "m1",
        "rules_version": "r1",
        "generator_source": "hybrid",
        "project_snapshot": {},
        "environment_snapshot": {},
        "preference_snapshot": {},
        "total_candidates": 2,
        "latency_ms": 50,
        "candidates": [
            {
                "candidate_rank": 1,
                "candidate_source": "live_rules",
                "candidate_payload": {"id": "a"},
                "was_shown_to_user": True,
            },
            {
                "candidate_rank": 2,
                "candidate_source": "ml_ranker",
                "candidate_payload": {"id": "b"},
                "was_shown_to_user": True,
            },
        ],
    }
    r = validate_recommendation_session_payload(payload)
    assert r.ok, r.errors


def test_session_rejects_mismatched_total_candidates() -> None:
    payload = {
        "project_id": "p",
        "model_version": "m",
        "rules_version": "r",
        "generator_source": "live_rules",
        "project_snapshot": {},
        "environment_snapshot": {},
        "preference_snapshot": {},
        "total_candidates": 3,
        "latency_ms": 1,
        "candidates": [
            {"candidate_rank": 1, "candidate_source": "x", "candidate_payload": {}},
        ],
    }
    r = validate_recommendation_session_payload(payload)
    assert not r.ok
    assert any("total_candidates" in e for e in r.errors)


def test_session_rejects_duplicate_ranks() -> None:
    payload = {
        "project_id": "p",
        "model_version": "m",
        "rules_version": "r",
        "generator_source": "live_rules",
        "project_snapshot": {},
        "environment_snapshot": {},
        "preference_snapshot": {},
        "total_candidates": 2,
        "latency_ms": 1,
        "candidates": [
            {"candidate_rank": 1, "candidate_source": "x", "candidate_payload": {}},
            {"candidate_rank": 1, "candidate_source": "y", "candidate_payload": {}},
        ],
    }
    r = validate_recommendation_session_payload(payload)
    assert not r.ok


def test_duplicate_event_hook() -> None:
    seen: set[str] = set()
    assert duplicate_event_protection_hook(seen, "e1").ok
    assert not duplicate_event_protection_hook(seen, "e1").ok
