from __future__ import annotations

from evaluation.governance.rollout_gates import evaluate_rollout_gate
from evaluation.governance.rollback_triggers import evaluate_rollback


def test_rollback_triggers_latency() -> None:
    snap = {
        "serving": {"p95_latency_ms": 5000, "error_rate": 0, "fallback_rate": 0.1},
        "baseline_p95_latency_ms": 1000,
        "engagement_proxies": {"select_rate": 0.2},
        "baseline_select_rate": 0.2,
    }
    r = evaluate_rollback(snap)
    assert r.should_rollback
    assert any("latency" in t for t in r.triggers)


def test_rollout_shadow_advance() -> None:
    snap = {"gate_blockers": []}
    d = evaluate_rollout_gate(current_phase="shadow", metrics_snapshot=snap)
    assert d.outcome == "ADVANCE"


def test_rollout_rollback_wins() -> None:
    snap = {
        "serving": {"p95_latency_ms": 5000, "error_rate": 0.1, "fallback_rate": 0.3},
        "baseline_p95_latency_ms": 1000,
        "engagement_proxies": {"select_rate": 0.01},
        "baseline_select_rate": 0.2,
    }
    d = evaluate_rollout_gate(current_phase="pct_25", metrics_snapshot=snap)
    assert d.outcome == "ROLLBACK"
