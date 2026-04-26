from __future__ import annotations

import json
from typing import Any


def map_constraint_snapshot_to_training_row(snapshot: dict[str, Any]) -> dict[str, float | int]:
    """Flatten a recommendation_constraint_snapshot into numeric training fields."""
    blocked_species = _len_json_list(snapshot.get("blocked_species_json"))
    blocked_mats = _len_json_list(snapshot.get("blocked_materials_json"))
    blocked_sol = _len_json_list(snapshot.get("blocked_solution_types_json"))
    allowed_sub = _len_json_dict_or_list(snapshot.get("allowed_substitutions_json"))

    supply = float(snapshot.get("supply_readiness_score") or 0.0)
    seasonal = float(snapshot.get("seasonal_readiness_score") or 0.0)
    penalty = (1.0 - supply) * 0.5 + (1.0 - seasonal) * 0.5

    return {
        "region_supply_readiness_score": supply,
        "seasonal_suitability_score": seasonal,
        "substitution_count": int(allowed_sub),
        "constraint_penalty_score": round(min(1.0, penalty), 4),
        "blocked_species_count": int(blocked_species),
        "blocked_materials_count": int(blocked_mats),
        "blocked_solution_types_count": int(blocked_sol),
        "deferred_execution_risk": 1.0 if supply < 0.35 or seasonal < 0.35 else 0.0,
    }


def _len_json_list(raw: Any) -> int:
    if not raw or not isinstance(raw, str):
        return 0
    try:
        v = json.loads(raw)
    except json.JSONDecodeError:
        return 0
    if isinstance(v, list):
        return len(v)
    return 0


def _len_json_dict_or_list(raw: Any) -> int:
    if not raw or not isinstance(raw, str):
        return 0
    try:
        v = json.loads(raw)
    except json.JSONDecodeError:
        return 0
    if isinstance(v, dict):
        return len(v)
    if isinstance(v, list):
        return len(v)
    return 0
