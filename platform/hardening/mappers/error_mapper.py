from __future__ import annotations

import json
from typing import Any


def map_error_contract_to_row(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "code": doc.get("code"),
        "message": doc.get("message"),
        "severity": doc.get("severity"),
        "retriable": doc.get("retriable"),
        "http_status_hint": doc.get("http_status_hint"),
        "correlation_id": doc.get("correlation_id"),
        "subsystem": doc.get("subsystem"),
        "details_json": json.dumps(doc.get("details"), sort_keys=True) if doc.get("details") is not None else "",
    }


def map_audit_event_to_row(doc: dict[str, Any]) -> dict[str, Any]:
    payload = doc.get("payload") if isinstance(doc.get("payload"), dict) else {}
    meta = doc.get("metadata") if isinstance(doc.get("metadata"), dict) else {}
    return {
        "audit_event_type": doc.get("audit_event_type"),
        "subsystem": doc.get("subsystem"),
        "actor_type": doc.get("actor_type"),
        "actor_id": doc.get("actor_id"),
        "entity_type": doc.get("entity_type"),
        "entity_id": doc.get("entity_id"),
        "action": doc.get("action"),
        "outcome": doc.get("outcome"),
        "severity": doc.get("severity"),
        "correlation_id": doc.get("correlation_id"),
        "payload_json": json.dumps(payload, sort_keys=True),
        "metadata_json": json.dumps(meta, sort_keys=True) if meta else "",
    }
