from __future__ import annotations

import json
from typing import Any


def map_consent_record_row(doc: dict[str, Any]) -> dict[str, Any]:
    meta = doc.get("metadata") if isinstance(doc.get("metadata"), dict) else {}
    return {
        "record_type": "consent_record",
        "user_id": doc.get("user_id"),
        "consent_scope": doc.get("consent_scope"),
        "consent_status": doc.get("consent_status"),
        "source_channel": doc.get("source_channel"),
        "granted_at": doc.get("granted_at"),
        "withdrawn_at": doc.get("withdrawn_at"),
        "expires_at": doc.get("expires_at"),
        "legal_basis": doc.get("legal_basis"),
        "metadata_json": json.dumps(meta, sort_keys=True) if meta else "",
    }


def map_policy_flag_row(doc: dict[str, Any]) -> dict[str, Any]:
    det = doc.get("detail") if isinstance(doc.get("detail"), dict) else {}
    meta = doc.get("metadata") if isinstance(doc.get("metadata"), dict) else {}
    return {
        "record_type": "policy_flag",
        "flag_type": doc.get("flag_type"),
        "severity": doc.get("severity"),
        "status": doc.get("status"),
        "title": doc.get("title"),
        "entity_type": doc.get("entity_type"),
        "entity_id": doc.get("entity_id"),
        "user_id": doc.get("user_id"),
        "project_id": doc.get("project_id"),
        "detail_json": json.dumps(det, sort_keys=True) if det else "",
        "metadata_json": json.dumps(meta, sort_keys=True) if meta else "",
    }


def map_governance_review_row(doc: dict[str, Any]) -> dict[str, Any]:
    find = doc.get("findings") if isinstance(doc.get("findings"), dict) else {}
    meta = doc.get("metadata") if isinstance(doc.get("metadata"), dict) else {}
    return {
        "record_type": "governance_review",
        "review_type": doc.get("review_type"),
        "status": doc.get("status"),
        "priority": doc.get("priority"),
        "subject_entity_type": doc.get("subject_entity_type"),
        "subject_entity_id": doc.get("subject_entity_id"),
        "related_user_id": doc.get("related_user_id"),
        "related_project_id": doc.get("related_project_id"),
        "resolution_summary": doc.get("resolution_summary"),
        "findings_json": json.dumps(find, sort_keys=True) if find else "",
        "metadata_json": json.dumps(meta, sort_keys=True) if meta else "",
    }


def map_governance_event_row(doc: dict[str, Any]) -> dict[str, Any]:
    rt = doc.get("record_type")
    if rt == "consent_record":
        return map_consent_record_row(doc)
    if rt == "policy_flag":
        return map_policy_flag_row(doc)
    if rt == "governance_review":
        return map_governance_review_row(doc)
    raise ValueError(f"unknown record_type: {rt!r}")
