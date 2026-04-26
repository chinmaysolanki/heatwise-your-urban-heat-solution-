"""
Soft ranking adjustments from geo/microclimate/site scores merged into ``environment``.

Applied after supply constraints, before final sort. Keeps deltas small (few %) so ML
heads remain primary signal.
"""

from __future__ import annotations

from typing import Any


def _f(env: dict[str, Any], key: str, default: float = 0.5) -> float:
    try:
        v = float(env.get(key, default))
        return max(0.0, min(1.0, v))
    except (TypeError, ValueError):
        return default


def apply_geo_site_adjustments_to_ranked(
    scored_rows: list[dict[str, Any]],
    environment: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    if not environment:
        return scored_rows
    if not environment.get("geo_overall_confidence") and not environment.get("geo_cooling_need_score"):
        return scored_rows

    cool_need = _f(environment, "geo_cooling_need_score")
    wind_site = _f(environment, "geo_wind_risk_score")
    heat_abs = _f(environment, "geo_heat_absorption_risk_score")
    irr_need = _f(environment, "geo_irrigation_need_risk_score")
    seasonal = _f(environment, "geo_seasonal_heat_stress_score")

    for row in scored_rows:
        if row.get("blocked"):
            continue
        cand = row.get("candidatePayload") or {}
        expl = row.get("explanation") or {}
        mult = 1.0

        cooling = str(cand.get("cooling_strategy") or "")
        shade = str(cand.get("shade_solution") or "").lower()
        irrig = str(cand.get("irrigation_type") or "").lower()

        if cooling in ("evapotranspiration",) and cool_need > 0.62:
            mult *= 1.0 + 0.045 * (cool_need - 0.62)
        if shade in ("pergola", "green_wall_segment", "shade_sail") and cool_need > 0.68:
            mult *= 1.0 + 0.025 * (cool_need - 0.68)
        if heat_abs > 0.68 and cooling in ("evapotranspiration", "shading"):
            mult *= 1.0 + 0.02 * (heat_abs - 0.68)

        if wind_site > 0.72 and shade in ("green_wall_segment", "shade_sail"):
            mult *= 0.985
        if wind_site > 0.78 and shade == "pergola":
            mult *= 0.988

        if irr_need > 0.65 and irrig in ("manual",):
            mult *= 0.982
        if irr_need > 0.62 and irrig in ("drip", "automatic"):
            mult *= 1.0 + 0.015 * (irr_need - 0.62)

        if seasonal > 0.65 and cooling in ("evapotranspiration",):
            mult *= 1.0 + 0.018 * (seasonal - 0.65)

        mult = max(0.92, min(1.06, mult))
        blended = float(row["scores"].get("blended") or 0.0) * mult
        row["scores"]["blended"] = round(blended, 6)
        expl["finalBlendedScore"] = row["scores"]["blended"]
        expl["geo_adjustment_multiplier"] = round(mult, 4)
        row["explanation"] = expl

    return scored_rows


def geo_telemetry_meta(environment: dict[str, Any] | None) -> dict[str, Any]:
    if not environment:
        return {"applied": False}
    if environment.get("geo_rules_version"):
        return {
            "applied": True,
            "geo_rules_version": environment.get("geo_rules_version"),
            "overall_confidence": _f(environment, "geo_overall_confidence", 0.5),
            "coarse_enrichment": bool(environment.get("geo_coarse_enrichment")),
        }
    return {"applied": False}


__all__ = ["apply_geo_site_adjustments_to_ranked", "geo_telemetry_meta"]
