from __future__ import annotations

import json
from typing import Any


def map_explanation_to_row(ex: dict[str, Any]) -> dict[str, Any]:
    return {
        "report_explanation_id": ex.get("report_explanation_id"),
        "recommendation_dossier_id": ex.get("recommendation_dossier_id"),
        "related_section_key": ex.get("related_section_key"),
        "explanation_type": ex.get("explanation_type"),
        "source_layer": ex.get("source_layer"),
        "source_reference_id": ex.get("source_reference_id"),
        "confidence_band": ex.get("confidence_band"),
        "payload_keys": _payload_keys(ex.get("explanation_payload_json")),
    }


def _payload_keys(raw: Any) -> str | None:
    if not isinstance(raw, str):
        return None
    try:
        obj = json.loads(raw)
        if isinstance(obj, dict):
            return ",".join(sorted(obj.keys()))
    except json.JSONDecodeError:
        return None
    return None
