from __future__ import annotations

from evaluation.monitoring.drift_detector import score_distribution_psi
from evaluation.monitoring.monitoring_metrics import aggregate_serving_from_exposures


def test_aggregate_serving() -> None:
    rows = [
        {"latency_ms": 100, "fallback_used": False},
        {"latency_ms": 200, "fallback_used": True},
        {"latency_ms": 300, "fallback_used": False},
    ]
    m = aggregate_serving_from_exposures(rows)
    assert m.request_volume == 3
    assert m.median_latency_ms == 200
    assert abs(m.fallback_rate - 1 / 3) < 1e-6


def test_psi_identical_distributions_low() -> None:
    base = [0.1 * i for i in range(100)]
    psi = score_distribution_psi(base, base, n_bins=10)
    assert psi < 0.01
