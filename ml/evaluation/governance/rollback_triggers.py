"""
Automatic rollback trigger evaluation from metric snapshots.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class RollbackEvaluation:
    should_rollback: bool
    triggers: list[str] = field(default_factory=list)


def evaluate_rollback(snapshot: dict) -> RollbackEvaluation:
    triggers: list[str] = []

    serving = snapshot.get("serving") or {}
    p95 = float(serving.get("p95_latency_ms") or 0)
    baseline_p95 = float(snapshot.get("baseline_p95_latency_ms") or p95)
    if baseline_p95 > 0 and p95 > baseline_p95 * 1.5 and p95 > 3000:
        triggers.append("severe_latency_regression")

    err = float(serving.get("error_rate") or 0)
    if err > 0.05:
        triggers.append("elevated_errors")

    fb = float(serving.get("fallback_rate") or 0)
    if fb > 0.25:
        triggers.append("elevated_fallback")

    if int(snapshot.get("unsafe_recommendation_count") or 0) > 0:
        triggers.append("unsafe_candidate_leakage")

    s_rate = float((snapshot.get("engagement_proxies") or {}).get("select_rate") or 0)
    base_s = float(snapshot.get("baseline_select_rate") or 0)
    if base_s > 0.05 and s_rate < base_s * 0.5:
        triggers.append("sharp_drop_select_rate")

    if snapshot.get("harmful_install_signal"):
        triggers.append("harmful_install_outcome_signal")

    return RollbackEvaluation(bool(triggers), triggers)
