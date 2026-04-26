"""
Staged rollout gate decisions: ADVANCE | HOLD | ROLLBACK | SHADOW_ONLY.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from evaluation.governance.rollback_triggers import RollbackEvaluation, evaluate_rollback

RolloutOutcome = Literal["ADVANCE", "HOLD", "ROLLBACK", "SHADOW_ONLY"]


@dataclass(frozen=True)
class GateDecision:
    outcome: RolloutOutcome
    phase: str
    reasons: list[str]


PHASE_ORDER = ["rules_only", "shadow", "pct_5", "pct_25", "pct_50", "pct_100"]


def next_phase(current: str) -> str | None:
    try:
        i = PHASE_ORDER.index(current)
    except ValueError:
        return None
    if i + 1 < len(PHASE_ORDER):
        return PHASE_ORDER[i + 1]
    return None


def evaluate_rollout_gate(
    *,
    current_phase: str,
    metrics_snapshot: dict,
    rollback_eval: RollbackEvaluation | None = None,
) -> GateDecision:
    reasons: list[str] = []
    rb = rollback_eval or evaluate_rollback(metrics_snapshot)

    if rb.should_rollback:
        return GateDecision("ROLLBACK", current_phase, rb.triggers)

    if current_phase == "rules_only":
        return GateDecision("SHADOW_ONLY", current_phase, ["enable_shadow_dual_run_before_live"])

    if current_phase == "shadow":
        # Require no critical anomalies (caller merges anomaly_rules output into snapshot)
        if metrics_snapshot.get("gate_blockers"):
            return GateDecision("HOLD", current_phase, list(metrics_snapshot["gate_blockers"]))
        return GateDecision("ADVANCE", current_phase, ["shadow_metrics_ok"])

    for p in ("pct_5", "pct_25", "pct_50"):
        if current_phase == p:
            if metrics_snapshot.get("subgroup_severe_regression"):
                return GateDecision("HOLD", current_phase, ["subgroup_regression"])
            if metrics_snapshot.get("install_underperform_treatment") and metrics_snapshot.get("has_install_data"):
                return GateDecision("HOLD", current_phase, ["install_outcome_worse_than_control"])
            if metrics_snapshot.get("engagement_worse_than_control"):
                return GateDecision("HOLD", current_phase, ["engagement_proxy_worse"])
            return GateDecision("ADVANCE", current_phase, [f"{p}_checks_passed"])

    if current_phase == "pct_100":
        return GateDecision("HOLD", current_phase, ["already_full_rollout"])

    return GateDecision("HOLD", current_phase, reasons or ["unspecified_phase"])
