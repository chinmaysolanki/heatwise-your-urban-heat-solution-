"""
Normalize live project / environment / preference JSON into bootstrap-style keys.

Unknown categorical values map to ``__unknown__``; raw snapshots stay in separate columns for audit.
"""

from __future__ import annotations

from typing import Any

# App / API key -> synthetic training column (subset; extend as app evolves)
PROJECT_KEY_MAP: dict[str, str] = {
    "project_type": "project_type",
    "space_kind": "project_type",
    "area_sqft": "area_sqft",
    "areaSqft": "area_sqft",
    "usable_area_pct": "usable_area_pct",
    "floor_level": "floor_level",
    "floorLevel": "floor_level",
    "city_tier": "city_tier",
    "climate_zone": "climate_zone",
    "region": "region",
    "budget_inr": "budget_inr",
    "budgetBand": "budget_inr",  # may need band→inr expansion elsewhere
}

ENV_KEY_MAP: dict[str, str] = {
    "sunlight_hours": "sunlight_hours",
    "sunlightHours": "sunlight_hours",
    "shade_level": "shade_level",
    "shadeLevel": "shade_level",
    "avg_summer_temp_c": "avg_summer_temp_c",
    "humidity_pct": "humidity_pct",
    "humidityPct": "humidity_pct",
    "rainfall_level": "rainfall_level",
    "water_availability": "water_availability",
    "irrigation_possible": "irrigation_possible",
    "irrigationAllowed": "irrigation_possible",
    "ambient_heat_severity": "ambient_heat_severity",
}

PREF_KEY_MAP: dict[str, str] = {
    "maintenance_preference": "maintenance_preference",
    "aesthetic_style": "aesthetic_style",
    "preferred_style": "aesthetic_style",
    "purpose_primary": "purpose_primary",
    "primary_goal": "purpose_primary",
    "child_pet_safe_required": "child_pet_safe_required",
    "petSafeRequired": "child_pet_safe_required",
    "edible_plants_preferred": "edible_plants_preferred",
    "flowering_preferred": "flowering_preferred",
}


def _bool01(v: Any) -> int:
    if v is True or v == 1 or str(v).lower() in ("1", "true", "yes"):
        return 1
    return 0


def map_project_features(
    project_snapshot: dict[str, Any],
    environment_snapshot: dict[str, Any],
    preference_snapshot: dict[str, Any],
) -> dict[str, Any]:
    out: dict[str, Any] = {}

    for src, col in PROJECT_KEY_MAP.items():
        if src in project_snapshot and project_snapshot[src] is not None:
            out[col] = project_snapshot[src]

    for src, col in ENV_KEY_MAP.items():
        if src in environment_snapshot and environment_snapshot[src] is not None:
            val = environment_snapshot[src]
            if col == "irrigation_possible":
                out[col] = _bool01(val)
            else:
                out[col] = val

    for src, col in PREF_KEY_MAP.items():
        if src in preference_snapshot and preference_snapshot[src] is not None:
            val = preference_snapshot[src]
            if col in (
                "child_pet_safe_required",
                "edible_plants_preferred",
                "flowering_preferred",
            ):
                out[col] = _bool01(val)
            else:
                out[col] = val

    return out


def flag_unknown_category(value: Any, allowed: frozenset[str]) -> tuple[Any, bool]:
    if value is None:
        return None, False
    s = str(value).strip()
    if s in allowed:
        return s, False
    return "__unknown__", True
