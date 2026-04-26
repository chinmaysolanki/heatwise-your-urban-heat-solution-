"""
Hard safety / business constraints — unsafe candidates are blocked (not ranked).
"""

from __future__ import annotations

from typing import Any


def evaluate_hard_constraints(
    project: dict[str, Any],
    environment: dict[str, Any],
    preferences: dict[str, Any],
    candidate: dict[str, Any],
) -> list[str]:
    """
    Return list of block reason codes (empty if OK).
    """
    reasons: list[str] = []

    load = str(project.get("load_capacity_level") or project.get("loadCapacityLevel") or "medium")
    est_cost = float(candidate.get("estimated_install_cost_inr") or 0)
    budget = float(project.get("budget_inr") or preferences.get("budget_inr") or 0)

    if load == "low" and candidate.get("greenery_density") == "high":
        reasons.append("HARD_LOAD_HIGH_GREENERY")

    if budget > 0 and est_cost > budget * 1.25:
        reasons.append("HARD_BUDGET_EXCEEDED")

    pet = int(preferences.get("child_pet_safe_required") or preferences.get("petSafeRequired") or 0)
    if pet and str(candidate.get("species_primary", "")).lower() in ("bougainvillea",):
        reasons.append("HARD_PET_UNSAFE_SPECIES")

    irr = str(candidate.get("irrigation_type") or "")
    water = str(environment.get("water_availability") or "")
    if water in ("scarce",) and irr in ("sprinkler", "mist"):
        reasons.append("HARD_WATER_SCARCE_SPRINKLER")

    floor = int(project.get("floor_level") or project.get("floorLevel") or 0)
    if floor > 15 and candidate.get("greenery_density") == "high":
        reasons.append("HARD_HIGH_RISE_HEAVY_GREENING")

    return reasons
