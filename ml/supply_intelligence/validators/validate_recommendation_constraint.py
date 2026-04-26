from __future__ import annotations

import json
from typing import Any


def _must_json_string(key: str, val: Any, errs: list[str]) -> None:
    if val is None:
        errs.append(f"missing {key}")
        return
    if not isinstance(val, str):
        errs.append(f"{key} must be JSON string")
        return
    try:
        json.loads(val)
    except json.JSONDecodeError:
        errs.append(f"{key} is not valid JSON")


def validate_recommendation_constraint_record(row: dict[str, Any]) -> list[str]:
    errs: list[str] = []
    if not str(row.get("constraint_snapshot_id") or "").strip():
        errs.append("missing constraint_snapshot_id")
    if not str(row.get("region") or "").strip():
        errs.append("missing region")
    if not str(row.get("climate_zone") or "").strip():
        errs.append("missing climate_zone")
    try:
        m = int(row.get("month_of_year"))
        if not 1 <= m <= 12:
            errs.append("month_of_year must be 1..12")
    except (TypeError, ValueError):
        errs.append("invalid month_of_year")
    for key in (
        "constraint_flags_json",
        "blocked_species_json",
        "blocked_materials_json",
        "blocked_solution_types_json",
        "allowed_substitutions_json",
    ):
        _must_json_string(key, row.get(key), errs)
    for key in ("supply_readiness_score", "seasonal_readiness_score"):
        try:
            v = float(row.get(key))
            if not 0 <= v <= 1:
                errs.append(f"{key} must be in [0,1]")
        except (TypeError, ValueError):
            errs.append(f"invalid {key}")
    return errs
