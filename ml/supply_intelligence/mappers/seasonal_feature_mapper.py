from __future__ import annotations

from typing import Any


def seasonal_features_for_window(row: dict[str, Any], month: int) -> dict[str, float | int | str]:
    """Features for a seasonal_window row evaluated at ``month`` (1–12)."""
    level = str(row.get("suitability_level") or "acceptable")
    score = {"optimal": 1.0, "acceptable": 0.8, "marginal": 0.55, "unsuitable": 0.2}.get(level, 0.6)
    return {
        "seasonal_suitability_score": score,
        "eval_month": int(month),
        "region": str(row.get("region") or ""),
        "climate_zone": str(row.get("climate_zone") or ""),
        "species_name": str(row.get("species_name") or ""),
        "solution_type": str(row.get("solution_type") or ""),
    }
