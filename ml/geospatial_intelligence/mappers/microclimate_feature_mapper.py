"""
Map microclimate_snapshot to flat derived + raw features.
"""

from __future__ import annotations

from typing import Any


def map_microclimate_to_features(mc: dict[str, Any], *, row_id: str | None = None) -> dict[str, Any]:
    mid = str(mc.get("microclimate_snapshot_id") or row_id or "")
    base = {
        "microclimate_row_id": mid,
        "project_id": str(mc.get("project_id") or ""),
        "mc_month_of_year": mc.get("month_of_year"),
        "mc_avg_day_temp_c": mc.get("avg_day_temp_c"),
        "mc_avg_night_temp_c": mc.get("avg_night_temp_c"),
        "mc_summer_peak_temp_c": mc.get("summer_peak_temp_c"),
        "mc_humidity_pct": mc.get("humidity_pct"),
        "mc_rainfall_level": mc.get("rainfall_level"),
        "mc_wind_exposure_score": mc.get("wind_exposure_score"),
        "mc_sun_exposure_score": mc.get("sun_exposure_score"),
        "mc_shade_cover_score": mc.get("shade_cover_score"),
        "mc_reflected_heat_risk_score": mc.get("reflected_heat_risk_score"),
        "mc_dust_exposure_score": mc.get("dust_exposure_score"),
        "mc_runoff_risk_score": mc.get("runoff_risk_score"),
        "mc_water_availability_score": mc.get("water_availability_score"),
        "mc_seasonal_heat_stress_score": mc.get("seasonal_heat_stress_score"),
        "mc_source_type": mc.get("source_type"),
        "mc_source_confidence": mc.get("source_confidence"),
    }
    # Derived proxies for training (deterministic transforms)
    sun = float(mc.get("sun_exposure_score") or 0.0)
    shade = float(mc.get("shade_cover_score") or 0.0)
    seasonal = float(mc.get("seasonal_heat_stress_score") or 0.0)
    base["mc_derived_net_sun_stress"] = max(0.0, min(1.0, sun * (1.0 - 0.7 * shade)))
    base["mc_derived_composite_heat_proxy"] = max(0.0, min(1.0, 0.5 * seasonal + 0.5 * base["mc_derived_net_sun_stress"]))
    return base
