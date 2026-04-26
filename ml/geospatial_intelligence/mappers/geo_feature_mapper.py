"""
Map geo_context (+ optional ids) to a flat row for ML / CSV joins.
"""

from __future__ import annotations

from typing import Any


def map_geo_context_to_features(
    geo: dict[str, Any],
    *,
    row_id: str | None = None,
    project_id: str | None = None,
) -> dict[str, Any]:
    gid = str(geo.get("geo_context_id") or row_id or "")
    out: dict[str, Any] = {
        "feature_row_id": gid,
        "project_id": str(project_id or geo.get("project_id") or ""),
        "geo_region": geo.get("region"),
        "geo_city": geo.get("city"),
        "geo_city_tier": geo.get("city_tier"),
        "geo_climate_zone": geo.get("climate_zone"),
        "geo_latitude": geo.get("latitude"),
        "geo_longitude": geo.get("longitude"),
        "geo_elevation_m": geo.get("elevation_m"),
        "geo_urban_density_band": geo.get("urban_density_band"),
        "geo_built_up_index": geo.get("built_up_index"),
        "geo_neighborhood_heat_risk_band": geo.get("neighborhood_heat_risk_band"),
        "geo_rainfall_band": geo.get("rainfall_band"),
        "geo_wind_exposure_region_band": geo.get("wind_exposure_region_band"),
        "geo_air_quality_band": geo.get("air_quality_band"),
        "geo_water_stress_band": geo.get("water_stress_band"),
        "geo_source_confidence": geo.get("source_confidence"),
        "geo_coarse_only": 1 if geo.get("latitude") is None else 0,
    }
    return out
