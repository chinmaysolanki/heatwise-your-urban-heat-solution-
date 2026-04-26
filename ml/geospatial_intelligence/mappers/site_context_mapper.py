"""
Map site_exposure_profile to flat risk / opportunity features.
"""

from __future__ import annotations

from typing import Any


def map_site_exposure_to_features(site: dict[str, Any], *, row_id: str | None = None) -> dict[str, Any]:
    sid = str(site.get("site_exposure_id") or row_id or "")
    return {
        "site_row_id": sid,
        "project_id": str(site.get("project_id") or ""),
        "site_project_type": site.get("project_type"),
        "site_orientation": site.get("orientation"),
        "site_floor_level": site.get("floor_level"),
        "site_surrounding_built_density": site.get("surrounding_built_density"),
        "site_roof_material": site.get("roof_material"),
        "site_surface_type": site.get("surface_type"),
        "site_sunlight_hours": site.get("sunlight_hours"),
        "site_shade_level": site.get("shade_level"),
        "site_heat_absorption_risk_score": site.get("heat_absorption_risk_score"),
        "site_wind_risk_score": site.get("wind_risk_score"),
        "site_water_retention_risk_score": site.get("water_retention_risk_score"),
        "site_irrigation_need_risk_score": site.get("irrigation_need_risk_score"),
        "site_privacy_exposure_score": site.get("privacy_exposure_score"),
        "site_cooling_need_score": site.get("cooling_need_score"),
        "site_biodiversity_opportunity_score": site.get("biodiversity_opportunity_score"),
        "site_maintenance_stress_score": site.get("maintenance_stress_score"),
        "site_overall_complexity_score": site.get("overall_site_complexity_score"),
    }
