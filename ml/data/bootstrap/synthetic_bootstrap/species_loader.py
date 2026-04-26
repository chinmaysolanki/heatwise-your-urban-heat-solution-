"""
Load species definitions from ``species_library.json`` with schema validation.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from synthetic_bootstrap.species import (
    ClimateTag,
    ContainerOk,
    Habit,
    MaintNeed,
    NativePref,
    RootAgg,
    Safety,
    SpeciesSpec,
    SunPref,
    WaterDemand,
)

REQUIRED_KEYS: frozenset[str] = frozenset(
    {
        "key",
        "species_name",
        "climate_suitability",
        "sunlight_preference",
        "water_demand",
        "maintenance_need",
        "root_aggressiveness",
        "pollinator_value",
        "edible",
        "child_pet_safety",
        "native_support",
        "container_suitability",
        "cooling_contribution",
        "privacy_contribution",
        "growth_habit",
    },
)


class SpeciesConfigError(ValueError):
    """Raised when ``species_library.json`` is missing, invalid, or fails validation."""


def _as_tuple_climate(raw: Any) -> tuple[ClimateTag, ...]:
    if not isinstance(raw, list) or not raw:
        raise SpeciesConfigError("climate_suitability must be a non-empty list of strings")
    out: list[ClimateTag] = []
    for x in raw:
        if not isinstance(x, str):
            raise SpeciesConfigError(f"invalid climate tag: {x!r}")
        out.append(x)  # type: ignore[arg-type]
    return tuple(out)


def _one_spec(row: dict[str, Any], idx: int) -> SpeciesSpec:
    missing = REQUIRED_KEYS - row.keys()
    if missing:
        raise SpeciesConfigError(f"species[{idx}] missing keys: {sorted(missing)}")
    try:
        return SpeciesSpec(
            key=str(row["key"]),
            species_name=str(row["species_name"]),
            climate_suitability=_as_tuple_climate(row["climate_suitability"]),
            sunlight_preference=row["sunlight_preference"],  # type: ignore[arg-type]
            water_demand=row["water_demand"],  # type: ignore[arg-type]
            maintenance_need=row["maintenance_need"],  # type: ignore[arg-type]
            root_aggressiveness=row["root_aggressiveness"],  # type: ignore[arg-type]
            pollinator_value=int(row["pollinator_value"]),
            edible=bool(row["edible"]),
            child_pet_safety=row["child_pet_safety"],  # type: ignore[arg-type]
            native_support=row["native_support"],  # type: ignore[arg-type]
            container_suitability=row["container_suitability"],  # type: ignore[arg-type]
            cooling_contribution=int(row["cooling_contribution"]),
            privacy_contribution=int(row["privacy_contribution"]),
            growth_habit=row["growth_habit"],  # type: ignore[arg-type]
        )
    except (TypeError, KeyError, ValueError) as e:
        raise SpeciesConfigError(f"species[{idx}] invalid field types or enum values: {e}") from e


def load_species_library_json(path: Path) -> tuple[SpeciesSpec, ...]:
    """
    Parse JSON species list; raises :class:`SpeciesConfigError` on failure.

    Expected shape: ``{"version": int, "species": [ {...}, ... ]}`` or a bare array.
    """
    if not path.is_file():
        raise SpeciesConfigError(f"species library not found: {path}")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise SpeciesConfigError(f"invalid JSON in {path}: {e}") from e

    rows = raw["species"] if isinstance(raw, dict) else raw
    if not isinstance(rows, list) or len(rows) == 0:
        raise SpeciesConfigError("species list must be a non-empty array")

    specs: list[SpeciesSpec] = []
    keys: set[str] = set()
    for i, row in enumerate(rows):
        if not isinstance(row, dict):
            raise SpeciesConfigError(f"species[{i}] must be an object")
        sp = _one_spec(row, i)
        if sp.key in keys:
            raise SpeciesConfigError(f"duplicate species key: {sp.key}")
        keys.add(sp.key)
        specs.append(sp)
    return tuple(specs)
