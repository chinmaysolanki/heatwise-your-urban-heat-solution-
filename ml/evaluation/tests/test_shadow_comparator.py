from __future__ import annotations

from evaluation.shadow.shadow_comparator import compare_shadow_outputs


def test_top1_match_and_overlap() -> None:
    primary = {
        "candidates": [
            {"candidateId": "a", "rank": 1, "scores": {"blended": 0.9}, "candidatePayload": {}},
            {"candidateId": "b", "rank": 2, "scores": {"blended": 0.8}, "candidatePayload": {}},
            {"candidateId": "c", "rank": 3, "scores": {"blended": 0.7}, "candidatePayload": {}},
        ],
        "telemetryMeta": {"rulesVersion": "r1"},
    }
    shadow = {
        "candidates": [
            {"candidateId": "a", "rank": 1, "scores": {"blended": 0.85}, "candidatePayload": {}},
            {"candidateId": "c", "rank": 2, "scores": {"blended": 0.75}, "candidatePayload": {}},
            {"candidateId": "b", "rank": 3, "scores": {"blended": 0.72}, "candidatePayload": {}},
        ],
        "telemetryMeta": {"rulesVersion": "r1"},
    }
    c = compare_shadow_outputs(primary, shadow)
    assert c.exact_top1_match is True
    assert c.top3_overlap_count == 3
    assert c.average_rank_shift > 0


def test_top1_mismatch() -> None:
    p = {"candidates": [{"candidateId": "x", "scores": {"blended": 1.0}, "candidatePayload": {}}]}
    s = {"candidates": [{"candidateId": "y", "scores": {"blended": 1.0}, "candidatePayload": {}}]}
    c = compare_shadow_outputs(p, s)
    assert c.exact_top1_match is False
    assert c.primary_top_id == "x"
    assert c.shadow_top_id == "y"
