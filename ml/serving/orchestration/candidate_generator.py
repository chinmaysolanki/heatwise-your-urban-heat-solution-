"""
Rule-based candidate generation (templates) before ML scoring.

Produces structured candidate dicts aligned with training column names where possible.
"""

from __future__ import annotations

import uuid
from typing import Any


def _cid() -> str:
    return f"cand_rule_{uuid.uuid4().hex[:12]}"


def generate_rule_candidates(
    project: dict[str, Any],
    environment: dict[str, Any],
    preferences: dict[str, Any],
    *,
    max_candidates: int = 8,
) -> list[dict[str, Any]]:
    """
    Deterministic template slate (v1): varies by project_type and cooling intent.
    """
    ptype = str(project.get("project_type") or project.get("space_kind") or "rooftop")
    budget = float(project.get("budget_inr") or preferences.get("budget_inr") or 80_000)
    purpose = str(preferences.get("purpose_primary") or "cooling")
    pet_safe = int(preferences.get("child_pet_safe_required") or preferences.get("petSafeRequired") or 0)

    templates: list[dict[str, Any]] = []

    def add(
        rec_type: str,
        greenery: str,
        planter: str,
        irrigation: str,
        shade: str,
        cooling: str,
        maint: str,
        mix: str,
        species: str,
        install: float,
        maint_inr: float,
        temp_c: float,
        surf_c: float,
        rule_score: float,
    ) -> None:
        templates.append(
            {
                "candidate_id": _cid(),
                "recommendation_type": rec_type,
                "greenery_density": greenery,
                "planter_type": planter,
                "irrigation_type": irrigation,
                "shade_solution": shade,
                "cooling_strategy": cooling,
                "maintenance_level_pred": maint,
                "species_mix_type": mix,
                "species_count_estimate": 4 if mix == "polyculture_lite" else 2,
                "estimated_install_cost_inr": min(install, budget * 1.1),
                "estimated_annual_maintenance_inr": maint_inr,
                "expected_temp_reduction_c": temp_c,
                "expected_surface_temp_reduction_c": surf_c,
                "species_primary": species,
                "species_secondary": species,
                "species_tertiary": species,
                "rule_template_score": rule_score,
            },
        )

    # Core cooling-first options
    add("planter", "medium", "raised", "drip", "pergola", "evapotranspiration", "low", "duo", "Bougainvillea", 45_000, 6000, 2.0, 4.0, 0.72)
    add("planter", "high", "raised", "drip", "green_wall_segment", "evapotranspiration", "medium", "polyculture_lite", "Money Plant", 65_000, 9000, 2.5, 5.0, 0.78)
    # Catalog-backed: matches SpeciesCatalog vinca (was "Curtain creeper", no canonical code).
    add(
        "shade_first",
        "low",
        "container",
        "manual",
        "shade_sail",
        "shading",
        "minimal",
        "mono",
        "Periwinkle (Vinca)",
        35_000,
        4000,
        1.2,
        3.0,
        0.65,
    )

    if ptype == "balcony":
        add("planter", "low", "container", "manual", "none", "evapotranspiration", "minimal", "duo", "Spider Plant", 22_000, 3000, 1.5, 3.5, 0.70)

    if purpose in ("food", "edible"):
        add("planter", "medium", "raised", "drip", "none", "evapotranspiration", "medium", "polyculture_lite", "Curry Leaf", 40_000, 7000, 1.8, 3.8, 0.68)

    if pet_safe:
        add("planter", "medium", "raised", "drip", "pergola", "evapotranspiration", "low", "duo", "Spider Plant", 38_000, 5500, 1.9, 4.0, 0.74)

    # De-duplicate by tuple of key fields, cap count
    seen: set[tuple[Any, ...]] = set()
    out: list[dict[str, Any]] = []
    for t in templates:
        key = (t["recommendation_type"], t["species_primary"], t["cooling_strategy"])
        if key in seen:
            continue
        seen.add(key)
        out.append(t)
        if len(out) >= max_candidates:
            break
    return out[:max_candidates]
