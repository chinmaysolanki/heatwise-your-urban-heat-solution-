"""
Map candidate_payload_json (live) to columns aligned with synthetic ``candidates.csv``.
"""

from __future__ import annotations

import json
from typing import Any


def parse_candidate_row(
    candidate_payload_json: str,
    species_payload_json: str | None,
    *,
    rank: int,
    snapshot_id: str,
    session_id: str,
    project_id: str,
    scores: dict[str, Any],
) -> dict[str, Any]:
    """Flatten one snapshot row for CSV export."""
    try:
        payload = json.loads(candidate_payload_json) if candidate_payload_json else {}
    except json.JSONDecodeError:
        payload = {"_parse_error": True, "raw": candidate_payload_json}

    species = {}
    if species_payload_json:
        try:
            species = json.loads(species_payload_json)
        except json.JSONDecodeError:
            species = {}

    row: dict[str, Any] = {
        "candidate_id": snapshot_id,
        "project_id": project_id,
        "recommendation_session_id": session_id,
        "rank_position": rank,
        "candidate_payload_raw": candidate_payload_json,
        "species_payload_raw": species_payload_json or "",
    }

    # Common keys if present in payload (camelCase + snake)
    for k_ml, keys in (
        ("recommendation_type", ("recommendation_type", "recommendationType")),
        ("greenery_density", ("greenery_density", "greeneryDensity")),
        ("planter_type", ("planter_type", "planterType")),
        ("irrigation_type", ("irrigation_type", "irrigationType")),
        ("species_primary", ("species_primary", "speciesPrimary", "primary_species")),
    ):
        for k in keys:
            if k in payload:
                row[k_ml] = payload[k]
                break

    if "species_primary" not in row and species.get("primary_name"):
        row["species_primary"] = species["primary_name"]

    for k in (
        "estimated_install_cost_inr",
        "feasibility_score",
        "safety_score",
        "heat_mitigation_score",
        "water_efficiency_score",
    ):
        if k in scores and scores[k] is not None:
            row[k] = scores[k]

    return row
