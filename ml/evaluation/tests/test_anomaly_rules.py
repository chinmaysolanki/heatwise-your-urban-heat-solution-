from __future__ import annotations

from evaluation.monitoring.anomaly_rules import evaluate_anomaly_rules


def test_unsafe_finding() -> None:
    f = evaluate_anomaly_rules({"unsafe_recommendation_count": 1})
    assert any(x.rule_id == "unsafe_leakage" for x in f)


def test_latency_finding() -> None:
    f = evaluate_anomaly_rules({"serving": {"p95_latency_ms": 99999}})
    assert any(x.rule_id == "latency_p95" for x in f)
