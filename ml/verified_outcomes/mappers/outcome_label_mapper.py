"""
Derive explicit training-oriented labels from verified install + outcome verification.

**Philosophy:** These are *rule-mapped* booleans / ordinals — not hidden heuristics.
Adjust thresholds in one place when product policy changes.

Label definitions
-------------------

``verified_install_match_label`` (binary)
  True iff ``matches_recommended_candidate`` and installer confidence ≥ 0.7
  and mismatch_reason_codes empty.

``recommendation_execution_success_label`` (binary)
  True if job reached ``completed`` AND verified_install exists AND
  ``verified_install_match_label`` OR user accepted deviation (we proxy:
  user_satisfaction ≥ 3 when mismatch).

``real_heat_mitigation_label`` (ordinal 0–2)
  0: no measured temp signal or tier low
  1: measured_temp_change_c ≤ -0.5 and tier medium+
  2: measured_temp_change_c ≤ -1.0 and tier high/gold

``real_feasibility_label`` (ordinal 0–2)
  From installer_feasibility_rating: <3 → 0, 3–3.9 → 1, ≥4 → 2 (when present).

``cost_accuracy_label`` (ordinal 0–2)
  Compare final_cost_inr vs quote_amount_inr if both present:
  ratio within 0.9–1.15 → 2, within 0.8–1.25 → 1, else 0.

``maintenance_fit_label`` (ordinal 0–2)
  From maintenance_adherence_score: ≥0.7 → 2, ≥0.4 → 1, else 0.

``survival_success_label`` (ordinal 0–2)
  plant_survival_90d ≥ 0.85 → 2, ≥ 0.6 → 1, else 0 (if missing → 0).

``installer_alignment_label`` (ordinal 0–2)
  Composite: high match + high outcome tier → 2;
  medium match or medium tier → 1; else 0.
"""

from __future__ import annotations

import json
from typing import Any


def _bool_match(verified_install: dict[str, Any]) -> bool:
    m = verified_install.get("matches_recommended_candidate") or verified_install.get("matchesRecommendedCandidate")
    conf = float(verified_install.get("installer_confidence_score") or verified_install.get("installerConfidenceScore") or 0)
    raw = verified_install.get("mismatch_reason_codes_json") or verified_install.get("mismatchReasonCodesJson") or "[]"
    codes = json.loads(raw) if isinstance(raw, str) else list(raw or [])
    return bool(m) and conf >= 0.7 and len(codes) == 0


def build_verified_labels(
    *,
    job: dict[str, Any],
    verified_install: dict[str, Any],
    outcome: dict[str, Any] | None,
    quote: dict[str, Any] | None,
) -> dict[str, Any]:
    job_status = str(job.get("job_status") or job.get("jobStatus") or "")
    has_verified = bool(verified_install.get("verified_install_id") or verified_install.get("id"))

    vi_match = _bool_match(verified_install)
    sat = outcome.get("user_satisfaction_score") or outcome.get("userSatisfactionScore") if outcome else None
    sat_f = float(sat) if sat is not None else None

    raw_m = (
        verified_install.get("mismatch_reason_codes_json")
        or verified_install.get("mismatchReasonCodesJson")
        or "[]"
    )
    codes = json.loads(raw_m) if isinstance(raw_m, str) else list(raw_m or [])
    exec_success = job_status == "completed" and has_verified and (vi_match or (sat_f is not None and sat_f >= 3 and len(codes) > 0))

    tier = str(outcome.get("verification_confidence_tier") or outcome.get("verificationConfidenceTier") or "low") if outcome else "low"
    mtc = outcome.get("measured_temp_change_c") if outcome else None
    mtc = outcome.get("measuredTempChangeC") if mtc is None and outcome else mtc
    mtc_f = float(mtc) if mtc is not None else None

    heat = 0
    if mtc_f is not None and tier in ("medium", "high", "gold"):
        if mtc_f <= -1.0 and tier in ("high", "gold"):
            heat = 2
        elif mtc_f <= -0.5:
            heat = 1

    ifr = outcome.get("installer_feasibility_rating") if outcome else None
    if ifr is None and outcome:
        ifr = outcome.get("installerFeasibilityRating")
    feas = 0
    if ifr is not None:
        x = float(ifr)
        feas = 2 if x >= 4 else 1 if x >= 3 else 0

    cost_l = 0
    if quote and job:
        qamt = quote.get("quote_amount_inr") or quote.get("quoteAmountInr")
        final = job.get("final_cost_inr") or job.get("finalCostInr")
        if isinstance(qamt, (int, float)) and isinstance(final, (int, float)) and qamt > 0:
            r = final / qamt
            cost_l = 2 if 0.9 <= r <= 1.15 else 1 if 0.8 <= r <= 1.25 else 0

    mad = outcome.get("maintenance_adherence_score") if outcome else None
    if mad is None and outcome:
        mad = outcome.get("maintenanceAdherenceScore")
    maint = 0
    if mad is not None:
        x = float(mad)
        maint = 2 if x >= 0.7 else 1 if x >= 0.4 else 0

    p90 = outcome.get("plant_survival_rate_90d") if outcome else None
    if p90 is None and outcome:
        p90 = outcome.get("plantSurvivalRate90d")
    surv = 0
    if p90 is not None:
        x = float(p90)
        surv = 2 if x >= 0.85 else 1 if x >= 0.6 else 0

    align = 0
    if vi_match and tier in ("high", "gold"):
        align = 2
    elif vi_match or tier in ("medium", "high", "gold"):
        align = 1

    return {
        "verified_install_match_label": vi_match,
        "recommendation_execution_success_label": bool(exec_success),
        "real_heat_mitigation_label": heat,
        "real_feasibility_label": feas,
        "cost_accuracy_label": cost_l,
        "maintenance_fit_label": maint,
        "survival_success_label": surv,
        "installer_alignment_label": align,
        "label_rules_version": "verified_outcomes.v1",
    }
