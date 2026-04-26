from __future__ import annotations

from typing import Any


def map_pricing_feature_row(inp: dict[str, Any]) -> dict[str, float | int | str]:
    """Flatten pricing_input-style dict into a numeric-friendly feature row."""
    proj = inp.get("project_snapshot") or {}
    cand = inp.get("candidate_snapshot") or {}
    area = float(proj.get("area") or proj.get("area_sqm") or 40)
    if area > 300:
        area = area / 10.764
    budget = float(proj.get("budget_inr") or 0) or float((inp.get("preference_snapshot") or {}).get("budget_inr") or 0)
    med = float(inp.get("predicted_install_median_inr") or 0)
    return {
        "feature_row_id": str(inp.get("feature_row_id") or "row"),
        "region": str(inp.get("region") or proj.get("region") or ""),
        "climate_zone": str(inp.get("climate_zone") or ""),
        "project_type": str(proj.get("project_type") or proj.get("space_kind") or ""),
        "area_sqm": area,
        "greenery_density": str(cand.get("greenery_density") or ""),
        "planter_type": str(cand.get("planter_type") or ""),
        "irrigation_type": str(cand.get("irrigation_type") or ""),
        "shade_solution": str(cand.get("shade_solution") or ""),
        "supply_readiness_score": float(inp.get("supply_readiness_score") or 0.5),
        "installer_readiness_score": float(inp.get("installer_readiness_score") or 0.5),
        "lead_time_risk": float(inp.get("lead_time_risk") or 0),
        "budget_ratio": (med / budget) if budget > 0 and med > 0 else 0.0,
        "structural_complexity_proxy": float(inp.get("structural_complexity_proxy") or 1.0),
    }
