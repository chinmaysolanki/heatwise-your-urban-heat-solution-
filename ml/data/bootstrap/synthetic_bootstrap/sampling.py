"""
Weighted sampling of input features (identifiers, space, environment, preferences).

Distributions are tuned for Indian urban rooftop / terrace / balcony contexts.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np

from synthetic_bootstrap.registries import ProfileName


def _pick(rng: np.random.Generator, choices: tuple[str, ...], weights: list[float]) -> str:
    w = np.array(weights, dtype=np.float64)
    w /= w.sum()
    idx = int(rng.choice(len(choices), p=w))
    return choices[idx]


def _lognorm_sqft(rng: np.random.Generator, mean: float, sigma: float, lo: float, hi: float) -> float:
    v = rng.lognormal(mean=math.log(mean), sigma=sigma)
    return float(max(lo, min(hi, v)))


def profile_project_weights(profile: ProfileName) -> tuple[tuple[str, ...], list[float]]:
    if profile == "balcony-heavy":
        return ("rooftop", "terrace", "balcony"), [0.15, 0.25, 0.60]
    if profile == "rooftop-heavy":
        return ("rooftop", "terrace", "balcony"), [0.65, 0.25, 0.10]
    return ("rooftop", "terrace", "balcony"), [0.42, 0.33, 0.25]


def profile_budget_scale(profile: ProfileName) -> tuple[float, float]:
    """(mean_inr, spread factor) multipliers."""
    if profile == "budget":
        return 35_000.0, 0.55
    if profile == "premium":
        return 180_000.0, 1.4
    return 85_000.0, 1.0


def profile_heat_bias(profile: ProfileName) -> float:
    """Added to normalized heat draw for hot-climate profile."""
    return 0.22 if profile == "hot-climate" else 0.0


def sample_input_features(
    sample_id: str,
    rng: np.random.Generator,
    profile: ProfileName,
    sampling_overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Draw one row of input-side features (no model outputs yet)."""
    from synthetic_bootstrap import registries as R

    so = sampling_overrides or {}

    ptypes, pw = profile_project_weights(profile)
    project_type = _pick(rng, ptypes, pw)

    if project_type == "balcony":
        area_sqft = _lognorm_sqft(
            rng,
            float(so.get("balcony_area_log_mean", 95)),
            float(so.get("balcony_area_log_sigma", 0.45)),
            35,
            420,
        )
        sun_mu = 5.0
    elif project_type == "terrace":
        area_sqft = _lognorm_sqft(
            rng,
            float(so.get("terrace_area_log_mean", 420)),
            float(so.get("terrace_area_log_sigma", 0.55)),
            120,
            2200,
        )
        sun_mu = 7.2
    else:
        area_sqft = _lognorm_sqft(
            rng,
            float(so.get("rooftop_area_log_mean", 1400)),
            float(so.get("rooftop_area_log_sigma", 0.65)),
            300,
            8000,
        )
        sun_mu = 8.5

    sunlight_hours = float(
        max(1.0, min(13.5, rng.normal(sun_mu, 1.55) + rng.normal(0, 0.35))),
    )

    heat_bias = profile_heat_bias(profile)
    sev_roll = float(min(1.0, max(0.0, rng.normal(0.48 + heat_bias, 0.22))))
    if sev_roll < 0.35:
        ambient_heat_severity = "low"
    elif sev_roll < 0.55:
        ambient_heat_severity = "moderate"
    elif sev_roll < 0.8:
        ambient_heat_severity = "high"
    else:
        ambient_heat_severity = "extreme"

    avg_summer_temp_c = float(
        max(28.0, min(44.0, rng.normal(34.5 + heat_bias * 6, 2.1))),
    )
    humidity_pct = int(max(28, min(92, round(rng.normal(62, 14)))))
    wind_exposure = float(max(0.05, min(0.98, rng.normal(0.48, 0.18))))

    shade_roll = sunlight_hours
    if shade_roll < 3.5:
        shade_level = _pick(rng, R.SHADE_LEVELS, [0.05, 0.15, 0.35, 0.45])
    elif shade_roll < 6:
        shade_level = _pick(rng, R.SHADE_LEVELS, [0.1, 0.25, 0.45, 0.2])
    else:
        shade_level = _pick(rng, R.SHADE_LEVELS, [0.35, 0.35, 0.22, 0.08])

    floor_level = int(max(1, min(45, round(rng.normal(8, 6)))))
    usable_area_pct = float(max(35.0, min(95.0, rng.normal(72.0, 10.0))))

    load_capacity_level = _pick(rng, R.LOAD_CAPACITY_LEVELS[:-1], [0.25, 0.45, 0.30])
    railing_height_ft = float(max(2.5, min(5.5, rng.normal(3.6, 0.45))))
    waterproofing_status = _pick(rng, R.WATERPROOFING, [0.45, 0.35, 0.12, 0.08])
    drainage_quality = _pick(rng, R.DRAINAGE_QUALITY, [0.18, 0.42, 0.40])
    access_ease = _pick(rng, R.ACCESS_EASE, [0.15, 0.35, 0.50])

    surface_type = _pick(
        rng,
        R.SURFACE_TYPES,
        [0.35, 0.28, 0.08, 0.06, 0.05, 0.03, 0.15],
    )
    roof_material = _pick(rng, R.ROOF_MATERIALS, [0.62, 0.12, 0.1, 0.04, 0.12])

    rainfall_level = _pick(rng, R.RAINFALL_LEVEL, [0.28, 0.48, 0.24])
    air_quality_level = _pick(rng, R.AIR_QUALITY, [0.18, 0.38, 0.32, 0.12])
    dust_exposure = _pick(rng, R.DUST_EXPOSURE, [0.22, 0.48, 0.30])

    water_availability = _pick(rng, R.WATER_AVAILABILITY, [0.12, 0.28, 0.42, 0.18])
    irrigation_possible = int(
        rng.random() < (0.88 if water_availability in ("adequate", "plentiful") else 0.42),
    )

    orientation = _pick(
        rng,
        R.ORIENTATIONS,
        [0.1, 0.08, 0.1, 0.08, 0.14, 0.08, 0.1, 0.08, 0.24],
    )
    surrounding_built_density = _pick(rng, R.BUILT_DENSITY, [0.12, 0.32, 0.38, 0.18])

    bmean, bspread = profile_budget_scale(profile)
    budget_inr = int(
        max(
            8_000,
            min(
                900_000,
                round(rng.normal(bmean, bmean * 0.45 * bspread / 0.85)),
            ),
        ),
    )

    maintenance_preference = _pick(rng, R.MAINTENANCE_PREF, [0.28, 0.35, 0.25, 0.12])
    aesthetic_style = _pick(
        rng,
        R.AESTHETIC_STYLES,
        [0.22, 0.18, 0.12, 0.14, 0.12, 0.1, 0.12],
    )
    purpose_primary = _pick(
        rng,
        R.PURPOSE_PRIMARY,
        [0.22, 0.14, 0.12, 0.18, 0.08, 0.14, 0.12],
    )

    child_pet_safe_required = int(rng.random() < 0.24)
    edible_plants_preferred = int(rng.random() < 0.42)
    flowering_preferred = int(rng.random() < 0.48)
    privacy_required = int(rng.random() < 0.28)
    seating_required = int(rng.random() < 0.18)
    shade_required = int(rng.random() < 0.32)
    biodiversity_priority = int(rng.random() < 0.22)
    native_species_preference = int(rng.random() < 0.35)

    if purpose_primary == "food":
        edible_plants_preferred = 1
    if purpose_primary == "privacy":
        privacy_required = 1
    if purpose_primary == "cooling":
        shade_required = int(min(1, shade_required + rng.integers(0, 2)))

    city_tier = _pick(rng, R.CITY_TIERS, [0.28, 0.32, 0.22, 0.18])
    climate_zone = _pick(
        rng,
        R.CLIMATE_ZONES,
        [0.38, 0.18, 0.22, 0.22],
    )
    region = _pick(
        rng,
        R.REGIONS,
        [0.14, 0.12, 0.1, 0.08, 0.08, 0.08, 0.07, 0.06, 0.05, 0.05, 0.04, 0.04, 0.09],
    )

    return {
        "sample_id": sample_id,
        "project_type": project_type,
        "city_tier": city_tier,
        "climate_zone": climate_zone,
        "region": region,
        "area_sqft": round(area_sqft, 2),
        "usable_area_pct": round(usable_area_pct, 1),
        "sunlight_hours": round(sunlight_hours, 2),
        "shade_level": shade_level,
        "floor_level": floor_level,
        "wind_exposure": round(wind_exposure, 4),
        "load_capacity_level": load_capacity_level,
        "railing_height_ft": round(railing_height_ft, 2),
        "waterproofing_status": waterproofing_status,
        "drainage_quality": drainage_quality,
        "access_ease": access_ease,
        "surface_type": surface_type,
        "roof_material": roof_material,
        "ambient_heat_severity": ambient_heat_severity,
        "avg_summer_temp_c": round(avg_summer_temp_c, 2),
        "humidity_pct": humidity_pct,
        "rainfall_level": rainfall_level,
        "air_quality_level": air_quality_level,
        "dust_exposure": dust_exposure,
        "water_availability": water_availability,
        "irrigation_possible": irrigation_possible,
        "orientation": orientation,
        "surrounding_built_density": surrounding_built_density,
        "budget_inr": budget_inr,
        "maintenance_preference": maintenance_preference,
        "aesthetic_style": aesthetic_style,
        "purpose_primary": purpose_primary,
        "child_pet_safe_required": child_pet_safe_required,
        "edible_plants_preferred": edible_plants_preferred,
        "flowering_preferred": flowering_preferred,
        "privacy_required": privacy_required,
        "seating_required": seating_required,
        "shade_required": shade_required,
        "biodiversity_priority": biodiversity_priority,
        "native_species_preference": native_species_preference,
    }
