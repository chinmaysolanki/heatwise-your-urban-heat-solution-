from __future__ import annotations

from serving.serving_response_contract import stdout_payload_is_usable


def test_usable_minimal_slate() -> None:
    body = {
        "mode": "rules_only",
        "telemetryMeta": {"rulesVersion": "x"},
        "candidates": [{"blocked": False, "candidateId": "a"}],
    }
    ok, reason = stdout_payload_is_usable(body)
    assert ok and reason == ""


def test_unusable_empty_candidates() -> None:
    body = {
        "mode": "rules_only",
        "telemetryMeta": {},
        "candidates": [],
    }
    ok, reason = stdout_payload_is_usable(body)
    assert not ok and reason == "unusable_empty_candidates"


def test_unusable_all_blocked() -> None:
    body = {
        "mode": "rules_only",
        "telemetryMeta": {},
        "candidates": [{"blocked": True}, {"blocked": True}],
    }
    ok, reason = stdout_payload_is_usable(body)
    assert not ok and reason == "unusable_all_candidates_blocked"


def test_unusable_heatwise_serving_ok_false() -> None:
    body = {
        "heatwiseServingOk": False,
        "mode": "rules_only",
        "telemetryMeta": {},
        "candidates": [{"blocked": False}],
    }
    ok, reason = stdout_payload_is_usable(body)
    assert not ok and reason == "unusable_heatwise_serving_ok_false"
