from __future__ import annotations

from typing import Any


def map_dossier_to_summary_row(d: dict[str, Any]) -> dict[str, Any]:
    """Wide summary row for dossier_summary_rows.csv."""
    return {
        "recommendation_dossier_id": d.get("recommendation_dossier_id"),
        "project_id": d.get("project_id"),
        "recommendation_session_id": d.get("recommendation_session_id"),
        "dossier_type": d.get("dossier_type"),
        "dossier_version": d.get("dossier_version"),
        "generated_at": d.get("generated_at"),
        "has_pricing_summary": int(d.get("pricing_summary_json") is not None),
        "has_supply_summary": int(d.get("supply_summary_json") is not None),
        "has_geo_summary": int(d.get("geospatial_summary_json") is not None),
        "selected_candidate_snapshot_id": d.get("selected_candidate_snapshot_id"),
    }
