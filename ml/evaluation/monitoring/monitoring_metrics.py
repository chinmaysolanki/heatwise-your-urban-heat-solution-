"""
Operational and quality-proxy metric definitions plus aggregation from exposure/eval rows.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Sequence


@dataclass
class ServingMetrics:
    request_volume: int = 0
    median_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    fallback_rate: float = 0.0
    error_rate: float = 0.0
    shadow_compute_failure_rate: float = 0.0


@dataclass
class EngagementProxyMetrics:
    save_rate: float = 0.0
    expand_rate: float = 0.0
    compare_rate: float = 0.0
    select_rate: float = 0.0
    installer_request_rate: float = 0.0
    ar_preview_request_rate: float = 0.0
    positive_explicit_feedback_rate: float = 0.0
    negative_explicit_feedback_rate: float = 0.0


@dataclass
class OutcomeMetrics:
    install_conversion_rate: float = 0.0
    post_install_satisfaction: float | None = None
    installer_feasibility_rating: float | None = None
    measured_temperature_change: float | None = None
    plant_survival_proxy: float | None = None


@dataclass
class DistributionHealthMetrics:
    project_type_mix: dict[str, float] = field(default_factory=dict)
    budget_band_mix: dict[str, float] = field(default_factory=dict)
    climate_zone_mix: dict[str, float] = field(default_factory=dict)
    top_species_frequency: dict[str, float] = field(default_factory=dict)
    score_histogram: list[float] = field(default_factory=list)
    candidate_count_mean: float = 0.0


def _percentile(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    k = min(len(sorted_vals) - 1, max(0, int(round(p * (len(sorted_vals) - 1)))))
    return sorted_vals[k]


def aggregate_serving_from_exposures(rows: Sequence[dict[str, Any]]) -> ServingMetrics:
    latencies = sorted(float(r.get("latency_ms") or 0) for r in rows)
    n = len(rows)
    if n == 0:
        return ServingMetrics()
    fallbacks = sum(1 for r in rows if r.get("fallback_used"))
    errors = sum(1 for r in rows if r.get("error"))
    shadow_fail = sum(1 for r in rows if r.get("shadow_compute_failed"))
    return ServingMetrics(
        request_volume=n,
        median_latency_ms=_percentile(latencies, 0.5),
        p95_latency_ms=_percentile(latencies, 0.95),
        fallback_rate=fallbacks / n,
        error_rate=errors / n,
        shadow_compute_failure_rate=shadow_fail / n,
    )


def aggregate_engagement_from_events(rows: Sequence[dict[str, Any]], *, impressions: int) -> EngagementProxyMetrics:
    if impressions <= 0:
        return EngagementProxyMetrics()
    def rate(event: str) -> float:
        return sum(1 for r in rows if r.get("event") == event) / impressions

    return EngagementProxyMetrics(
        save_rate=rate("save"),
        expand_rate=rate("expand"),
        compare_rate=rate("compare"),
        select_rate=rate("select"),
        installer_request_rate=rate("installer_request"),
        ar_preview_request_rate=rate("ar_preview"),
        positive_explicit_feedback_rate=rate("feedback_positive"),
        negative_explicit_feedback_rate=rate("feedback_negative"),
    )


def merge_metric_dicts(
    serving: ServingMetrics,
    engagement: EngagementProxyMetrics,
    outcomes: OutcomeMetrics,
    dist: DistributionHealthMetrics,
) -> dict[str, Any]:
    return {
        "serving": serving.__dict__,
        "engagement_proxies": engagement.__dict__,
        "outcomes": outcomes.__dict__,
        "distribution": dist.__dict__,
    }
