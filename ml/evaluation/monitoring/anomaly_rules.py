"""
Threshold-based anomaly checks on aggregated metric snapshots.
See ``alert_policy.md`` for numeric defaults.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class AnomalyFinding:
    rule_id: str
    severity: str
    message: str
    details: dict[str, Any]


def evaluate_anomaly_rules(snapshot: dict[str, Any], thresholds: dict[str, float] | None = None) -> list[AnomalyFinding]:
    t = thresholds or {}
    findings: list[AnomalyFinding] = []

    def g(key: str, default: float) -> float:
        return float(t.get(key, default))

    serving = snapshot.get("serving") or {}
    eng = snapshot.get("engagement_proxies") or {}
    dist = snapshot.get("distribution") or {}

    p95 = float(serving.get("p95_latency_ms") or 0)
    if p95 > g("p95_latency_ms_max", 2500):
        findings.append(
            AnomalyFinding("latency_p95", "high", "p95 latency above threshold", {"p95_latency_ms": p95}),
        )

    fb = float(serving.get("fallback_rate") or 0)
    if fb > g("fallback_rate_max", 0.15):
        findings.append(
            AnomalyFinding("fallback_spike", "high", "fallback rate elevated", {"fallback_rate": fb}),
        )

    err = float(serving.get("error_rate") or 0)
    if err > g("error_rate_max", 0.02):
        findings.append(AnomalyFinding("error_spike", "critical", "error rate elevated", {"error_rate": err}))

    s_rate = float(eng.get("select_rate") or 0)
    baseline_sel = float(snapshot.get("baseline_select_rate") or 0.2)
    if baseline_sel > 0 and s_rate < baseline_sel * (1 - g("select_drop_fraction", 0.35)):
        findings.append(
            AnomalyFinding("select_drop", "medium", "select rate materially below baseline", {"select_rate": s_rate}),
        )

    unsafe = int(snapshot.get("unsafe_recommendation_count") or 0)
    if unsafe > int(g("unsafe_max", 0)):
        findings.append(
            AnomalyFinding("unsafe_leakage", "critical", "unsafe recommendation incidence > 0", {"count": unsafe}),
        )

    psi = float(snapshot.get("score_psi") or 0)
    if psi > g("psi_alert", 0.25):
        findings.append(AnomalyFinding("score_psi", "medium", "score distribution drift (PSI)", {"psi": psi}))

    mix_shift = float(snapshot.get("project_type_mix_shift_l1") or 0)
    if mix_shift > g("mix_shift_max", 0.2):
        findings.append(
            AnomalyFinding("cohort_mix_shift", "low", "unexpected project type mix change", {"l1": mix_shift}),
        )

    return findings
