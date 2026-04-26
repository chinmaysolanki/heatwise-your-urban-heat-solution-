from __future__ import annotations

from typing import Any

CONFIDENCE_TIERS = frozenset({"low", "medium", "high", "gold"})


def validate_outcome_verification(row: dict[str, Any]) -> tuple[bool, list[str]]:
    errs: list[str] = []
    tier = str(row.get("verification_confidence_tier") or row.get("verificationConfidenceTier") or "")
    if tier not in CONFIDENCE_TIERS:
        errs.append("invalid_verification_confidence_tier")

    def clip_rate(name: str, v: Any) -> None:
        if v is None:
            return
        if not isinstance(v, (int, float)) or v < 0 or v > 1:
            errs.append(f"{name}_must_be_0_1")

    clip_rate("plant_survival_rate_30d", row.get("plant_survival_rate_30d") or row.get("plantSurvivalRate30d"))
    clip_rate("plant_survival_rate_90d", row.get("plant_survival_rate_90d") or row.get("plantSurvivalRate90d"))
    clip_rate("maintenance_adherence_score", row.get("maintenance_adherence_score") or row.get("maintenanceAdherenceScore"))

    for name, key in [
        ("user_satisfaction", "user_satisfaction_score"),
        ("user_satisfaction", "userSatisfactionScore"),
        ("installer_feasibility", "installer_feasibility_rating"),
        ("installer_feasibility", "installerFeasibilityRating"),
    ]:
        v = row.get(key)
        if v is None:
            continue
        if not isinstance(v, (int, float)) or v < 0 or v > 5:
            errs.append(f"{name}_0_5")

    for name, key in [
        ("measured_temp_change_c", "measured_temp_change_c"),
        ("measured_temp_change_c", "measuredTempChangeC"),
    ]:
        v = row.get(key)
        if v is None:
            continue
        if not isinstance(v, (int, float)) or v < -15 or v > 15:
            errs.append("measured_temp_change_absurd")

    return len(errs) == 0, errs
