from __future__ import annotations

import json
from typing import Any


def map_partner_profile_row(doc: dict[str, Any]) -> dict[str, Any]:
    areas = doc.get("service_areas") if isinstance(doc.get("service_areas"), list) else []
    pc = doc.get("primary_contact") if isinstance(doc.get("primary_contact"), dict) else {}
    meta = doc.get("metadata") if isinstance(doc.get("metadata"), dict) else {}
    return {
        "record_type": "partner_profile",
        "installer_id": doc.get("installer_id"),
        "organization_name": doc.get("organization_name"),
        "legal_entity_name": doc.get("legal_entity_name"),
        "compliance_status": doc.get("compliance_status"),
        "partner_active_status": doc.get("partner_active_status"),
        "service_areas_json": json.dumps(areas, sort_keys=True),
        "primary_contact_json": json.dumps(pc, sort_keys=True) if pc else "",
        "metadata_json": json.dumps(meta, sort_keys=True) if meta else "",
    }


def map_partner_capability_row(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "record_type": "partner_capability",
        "installer_id": doc.get("installer_id"),
        "project_types_json": json.dumps(sorted(doc.get("project_types") or [])),
        "solution_types_json": json.dumps(sorted(doc.get("solution_types") or [])),
        "complexity_bands_json": json.dumps(sorted(doc.get("complexity_bands") or [])),
        "seasonal_constraints_json": json.dumps(doc.get("seasonal_constraints") or {}, sort_keys=True),
        "service_readiness": doc.get("service_readiness"),
        "matrix_extras_json": json.dumps(doc.get("matrix_extras") or {}, sort_keys=True)
        if doc.get("matrix_extras")
        else "",
    }


def map_field_ops_row(doc: dict[str, Any]) -> dict[str, Any]:
    gaps = doc.get("coverage_gaps") if isinstance(doc.get("coverage_gaps"), list) else []
    rr = doc.get("regional_readiness") if isinstance(doc.get("regional_readiness"), dict) else {}
    notes = doc.get("signal_notes") if isinstance(doc.get("signal_notes"), dict) else {}
    return {
        "record_type": "field_ops_status",
        "installer_id": doc.get("installer_id"),
        "availability_state": doc.get("availability_state"),
        "pause_state": doc.get("pause_state"),
        "overload_signal": doc.get("overload_signal"),
        "coverage_gaps_json": json.dumps(gaps, sort_keys=True),
        "regional_readiness_json": json.dumps(rr, sort_keys=True),
        "signal_notes_json": json.dumps(notes, sort_keys=True) if notes else "",
    }
