"""
Rule-based recommendation synthesis and label scoring.

Turns sampled input features into installation outputs, species triples, and ML-style targets.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from synthetic_bootstrap.registries import PLANTER_TYPES, RECOMMENDATION_TYPES
from synthetic_bootstrap.species import SpeciesSpec, get_species_library


def _heat_score(ambient: str, temp_c: float) -> float:
    base = {"low": 0.15, "moderate": 0.4, "high": 0.65, "extreme": 0.9}[ambient]
    return float(min(1.0, base + max(0, temp_c - 33) * 0.035))


def _water_stress(water_availability: str, irrigation_possible: int) -> float:
    w = {"scarce": 0.9, "limited": 0.55, "adequate": 0.25, "plentiful": 0.1}[
        water_availability
    ]
    if not irrigation_possible:
        w = min(1.0, w + 0.35)
    return w


def _sun_bucket(hours: float) -> str:
    if hours < 3.5:
        return "SHADE"
    if hours < 6.5:
        return "PART"
    return "FULL"


def _species_eligible(sp: SpeciesSpec, inputs: dict[str, Any]) -> bool:
    if inputs["child_pet_safe_required"] and sp.child_pet_safety == "UNSAFE":
        return False
    return True


def _species_score(sp: SpeciesSpec, inputs: dict[str, Any], heat: float, water_stress: float) -> float:
    if not _species_eligible(sp, inputs):
        return -1e9
    score = 0.0
    sun_b = _sun_bucket(float(inputs["sunlight_hours"]))
    if sp.sunlight_preference == sun_b:
        score += 2.2
    elif sun_b == "PART" and sp.sunlight_preference in ("FULL", "SHADE"):
        score += 0.8
    elif sun_b == "FULL" and sp.sunlight_preference == "PART":
        score += 1.0
    elif sun_b == "SHADE" and sp.sunlight_preference == "SHADE":
        score += 2.5
    elif sun_b == "SHADE" and sp.sunlight_preference == "FULL":
        score -= 1.2

    if heat > 0.55:
        score += sp.cooling_contribution * 0.45
        if sp.water_demand == "LOW":
            score += 1.1 * water_stress
        if sp.water_demand == "HIGH":
            score -= 1.3 * water_stress
        if _heat_tolerant(sp):
            score += 0.9
    else:
        score += 0.3 * sp.pollinator_value

    if water_stress > 0.55 and sp.water_demand == "LOW":
        score += 1.4
    if water_stress > 0.55 and sp.water_demand == "HIGH":
        score -= 1.8

    if inputs["edible_plants_preferred"] and sp.edible:
        score += 1.35
    if inputs["flowering_preferred"] and sp.pollinator_value >= 2:
        score += 0.75

    if inputs["native_species_preference"] and sp.native_support == "HIGH":
        score += 0.85
    elif inputs["native_species_preference"] and sp.native_support == "LOW":
        score -= 0.25

    if inputs["privacy_required"]:
        score += sp.privacy_contribution * 0.55

    if inputs["biodiversity_priority"]:
        score += sp.pollinator_value * 0.35

    mp = inputs["maintenance_preference"]
    if mp == "minimal" and sp.maintenance_need == "LOW":
        score += 1.1
    if mp in ("minimal", "low") and sp.maintenance_need == "HIGH":
        score -= 0.9

    cont = sp.container_suitability
    if inputs["project_type"] == "balcony" and cont in ("POOR", "FAIR"):
        score -= 0.6
    if inputs["project_type"] == "rooftop" and cont == "EXCELLENT":
        score += 0.35

    if inputs["load_capacity_level"] == "low" and sp.root_aggressiveness == "HIGH":
        score -= 1.2
    if inputs["load_capacity_level"] == "low" and sp.growth_habit in ("SHRUB", "GRASS") and sp.key in (
        "bougainvillea",
        "bamboo_dwarf",
        "areca_palm_dwarf",
    ):
        score -= 0.8

    return score


def _heat_tolerant(sp: SpeciesSpec) -> bool:
    """Rough proxy for heat-hardy / low-water species."""
    return "HOT_DRY" in sp.climate_suitability or sp.water_demand == "LOW"


def _select_species(
    inputs: dict[str, Any],
    rng: np.random.Generator,
    heat: float,
    water_stress: float,
) -> tuple[str, str, str, str, int]:
    scored: list[tuple[float, SpeciesSpec]] = []
    for sp in get_species_library():
        s = _species_score(sp, inputs, heat, water_stress)
        s += rng.normal(0, 0.35)
        if s > -1e8:
            scored.append((s, sp))
    scored.sort(key=lambda x: x[0], reverse=True)
    if len(scored) < 3:
        # relax pet filter for fill
        for sp in get_species_library():
            if all(sp.key != x[1].key for x in scored):
                scored.append((0.0, sp))
        scored.sort(key=lambda x: x[0], reverse=True)

    top = [x[1] for x in scored[: max(15, len(scored))]]
    p0, p1, p2 = top[0], top[1 % len(top)], top[2 % len(top)]

    area = float(inputs["area_sqft"])
    if area < 70:
        mix = "single_species"
        n = 1
        p1 = p0
        p2 = p0
    elif area < 180:
        mix = rng.choice(["single_species", "duo_complement"], p=[0.35, 0.65])
        n = 1 if mix == "single_species" else 2
        if mix == "single_species":
            p1 = p0
            p2 = p0
    elif area < 600:
        mix = rng.choice(
            ["duo_complement", "tri_layer_simple"],
            p=[0.45, 0.55],
        )
        n = 3 if mix == "tri_layer_simple" else 2
        if n == 2:
            p2 = p1
    else:
        mix = rng.choice(
            ["tri_layer_simple", "polyculture_lite"],
            p=[0.55, 0.45],
        )
        n = 4 if mix == "polyculture_lite" else 3

    return p0.species_name, p1.species_name, p2.species_name, mix, n


def synthesize_outputs(inputs: dict[str, Any], rng: np.random.Generator) -> dict[str, Any]:
    """Given input feature dict, produce installation + species + target columns."""
    heat = _heat_score(inputs["ambient_heat_severity"], float(inputs["avg_summer_temp_c"]))
    ws = _water_stress(inputs["water_availability"], int(inputs["irrigation_possible"]))
    area = float(inputs["area_sqft"])
    budget = int(inputs["budget_inr"])

    # Greenery density
    if area < 65:
        gd = rng.choice(["sparse", "moderate"], p=[0.65, 0.35])
    elif heat > 0.62 and budget > 55_000:
        gd = rng.choice(
            ["moderate", "dense", "very_dense"],
            p=[0.25, 0.45, 0.30],
        )
    else:
        gd = rng.choice(
            ["sparse", "moderate", "dense"],
            p=[0.28, 0.48, 0.24],
        )

    if gd == "very_dense" and area < 90:
        gd = "moderate"
    if gd == "dense" and area < 50:
        gd = "sparse"

    # Planter / irrigation
    if budget < 25_000 or inputs["maintenance_preference"] == "minimal":
        planter = rng.choice(
            ["plastic_basic", "fabric_grow_bag", "terracotta"],
            p=[0.45, 0.3, 0.25],
        )
    elif budget > 200_000:
        planter = rng.choice(
            ["concrete_custom", "modular_rail_planters", "metal_trough"],
            p=[0.35, 0.35, 0.30],
        )
    else:
        planter = rng.choice(list(PLANTER_TYPES))

    if ws > 0.65 or not inputs["irrigation_possible"]:
        irrig = rng.choice(["manual_watering", "rainfed_only"], p=[0.55, 0.45])
    elif budget > 120_000 and inputs["irrigation_possible"]:
        irrig = rng.choice(
            ["drip_timer", "drip_smart", "subirrigation"],
            p=[0.35, 0.4, 0.25],
        )
    else:
        irrig = rng.choice(
            ["manual_watering", "drip_timer"],
            p=[0.55, 0.45],
        )
    if not inputs["irrigation_possible"] and str(irrig).startswith("drip"):
        irrig = "manual_watering"

    # Shade / cooling
    if inputs["shade_required"] or heat > 0.7:
        shade = rng.choice(
            ["shade_net_50", "shade_net_75", "pergola_lite", "companion_tall_plants"],
            p=[0.35, 0.25, 0.15, 0.25],
        )
    elif heat > 0.45:
        shade = rng.choice(["none", "shade_net_50", "umbrella_portable"], p=[0.35, 0.4, 0.25])
    else:
        shade = rng.choice(["none", "umbrella_portable"], p=[0.72, 0.28])

    if heat > 0.58 and gd in ("dense", "very_dense"):
        cooling = rng.choice(
            ["evapotranspiration_heavy", "combined_shade_et"],
            p=[0.45, 0.55],
        )
    elif heat > 0.5:
        cooling = rng.choice(
            ["evapotranspiration_light", "surface_shading", "combined_shade_et"],
            p=[0.35, 0.3, 0.35],
        )
    else:
        cooling = rng.choice(
            ["evapotranspiration_light", "reflective_mulch"],
            p=[0.65, 0.35],
        )

    # Recommendation type
    if inputs["purpose_primary"] == "food" and inputs["edible_plants_preferred"]:
        rec_t = rng.choice(["herb_focused", "mixed_canopy_lite"], p=[0.55, 0.45])
    elif heat > 0.65 and budget > 40_000:
        rec_t = rng.choice(
            ["shade_first_greenery", "intensive_green_roof_lite", "mixed_canopy_lite"],
            p=[0.35, 0.35, 0.30],
        )
    elif ws > 0.7:
        rec_t = rng.choice(["succulent_forward", "planters_only"], p=[0.5, 0.5])
    elif area > 900 and budget > 80_000:
        rec_t = rng.choice(
            ["raised_beds", "intensive_green_roof_lite"],
            p=[0.5, 0.5],
        )
    else:
        rec_t = rng.choice(list(RECOMMENDATION_TYPES))

    if inputs["load_capacity_level"] == "low" and rec_t == "intensive_green_roof_lite":
        rec_t = "planters_only"

    sp1, sp2, sp3, mix, n_est = _select_species(inputs, rng, heat, ws)

    # Maintenance level predicted
    maint_map = {"minimal": 0, "low": 1, "moderate": 2, "high": 3}
    base_m = maint_map[str(inputs["maintenance_preference"])]
    if gd in ("dense", "very_dense"):
        base_m += 1
    if irrig in ("drip_smart", "subirrigation"):
        base_m = max(0, base_m - 1)
    base_m = int(max(0, min(3, base_m)))
    maint_labels = ("L0_minimal", "L1_light", "L2_moderate", "L3_intensive")
    maintenance_level_pred = maint_labels[base_m]

    # Costs (INR heuristics)
    density_mul = {"sparse": 0.65, "moderate": 1.0, "dense": 1.45, "very_dense": 1.85}[gd]
    install = (
        area * (180 + 95 * heat) * density_mul
        + (4200 if shade != "none" else 0)
        + (8000 if irrig.startswith("drip") else 0)
    )
    install *= 0.85 + 0.35 * (budget / max(budget, 1) ** 0.5) / 30
    install = float(max(12_000, min(budget * 1.15, install * rng.uniform(0.88, 1.12))))
    annual_maint = install * rng.uniform(0.06, 0.16) * (0.75 if base_m <= 1 else 1.15)

    # Physics-ish outcomes
    et_c = (2.0 + heat * 5.5 + (3.5 if gd in ("dense", "very_dense") else 1.2)) * rng.uniform(
        0.85,
        1.12,
    )
    surf_c = et_c * rng.uniform(1.1, 1.9)
    poll = float(
        min(
            1.0,
            max(
                0.05,
                (n_est * 0.12 + heat * 0.15 + (0.2 if inputs["biodiversity_priority"] else 0)),
            ),
        ),
    )
    priv = float(
        min(
            1.0,
            max(
                0.05,
                inputs["privacy_required"] * 0.25
                + (0.35 if any(
                    x in sp1.lower() + sp2.lower()
                    for x in ("lemongrass", "bamboo", "bougainvillea", "curry")
                ) else 0.1),
            ),
        ),
    )

    load_ok = 1.0 if inputs["load_capacity_level"] != "low" else 0.72
    water_ok = 1.0 - ws * 0.35
    access_ok = {"difficult": 0.75, "moderate": 0.9, "easy": 1.0}[inputs["access_ease"]]
    feasibility = float(
        min(
            1.0,
            max(
                0.12,
                0.35 + 0.25 * load_ok + 0.2 * water_ok + 0.2 * access_ok + rng.normal(0, 0.04),
            ),
        ),
    )
    safety = float(
        min(
            1.0,
            max(
                0.2,
                0.86
                + (0.06 if inputs["child_pet_safe_required"] else 0.0)
                - (0.1 if inputs["railing_height_ft"] < 3.2 else 0.0)
                + rng.normal(0, 0.03),
            ),
        ),
    )

    acc_l = float(
        min(
            1.0,
            max(
                0.08,
                0.55
                + 0.15 * (1 - ws)
                + 0.1 * (budget / 200_000) ** 0.5
                - 0.08 * base_m
                + rng.normal(0, 0.06),
            ),
        ),
    )
    long_l = float(
        min(
            1.0,
            max(
                0.05,
                acc_l * 0.92
                - 0.12 * ws
                + (0.06 if inputs["drainage_quality"] == "good" else -0.05)
                + rng.normal(0, 0.05),
            ),
        ),
    )
    heat_mit = float(
        min(1.0, max(0.0, min(1.0, et_c / 10.0) + heat * 0.12)),
    )
    water_eff = float(min(1.0, max(0.0, 1.0 - ws * 0.55 + (0.2 if irrig.startswith("drip") else 0))))
    overall = float(
        min(
            1.0,
            max(
                0.1,
                0.28 * acc_l
                + 0.26 * long_l
                + 0.22 * heat_mit
                + 0.14 * water_eff
                + 0.1 * feasibility
                + rng.normal(0, 0.03),
            ),
        ),
    )

    return {
        "recommendation_type": rec_t,
        "greenery_density": gd,
        "planter_type": planter,
        "irrigation_type": irrig,
        "shade_solution": shade,
        "cooling_strategy": cooling,
        "maintenance_level_pred": maintenance_level_pred,
        "estimated_install_cost_inr": round(install, 2),
        "estimated_annual_maintenance_inr": round(annual_maint, 2),
        "expected_temp_reduction_c": round(et_c, 3),
        "expected_surface_temp_reduction_c": round(surf_c, 3),
        "pollinator_support_score": round(poll, 4),
        "privacy_score": round(priv, 4),
        "feasibility_score": round(feasibility, 4),
        "safety_score": round(safety, 4),
        "species_primary": sp1,
        "species_secondary": sp2,
        "species_tertiary": sp3,
        "species_mix_type": mix,
        "species_count_estimate": n_est,
        "recommendation_acceptance_likelihood": round(acc_l, 4),
        "long_term_success_likelihood": round(long_l, 4),
        "heat_mitigation_score": round(heat_mit, 4),
        "water_efficiency_score": round(water_eff, 4),
        "overall_recommendation_score": round(overall, 4),
    }

