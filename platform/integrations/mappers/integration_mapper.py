from __future__ import annotations

import json
from typing import Any


def map_integration_event_to_row(doc: dict[str, Any]) -> dict[str, Any]:
    """Flatten integration event for CSV / warehouse loads."""
    payload = doc.get("payload") if isinstance(doc.get("payload"), dict) else {}
    meta = doc.get("metadata") if isinstance(doc.get("metadata"), dict) else {}
    return {
        "event_type": doc.get("event_type"),
        "domain": doc.get("domain"),
        "source_system": doc.get("source_system"),
        "target_system": doc.get("target_system"),
        "entity_type": doc.get("entity_type"),
        "entity_id": doc.get("entity_id"),
        "correlation_id": doc.get("correlation_id"),
        "payload_json": json.dumps(payload, sort_keys=True),
        "metadata_json": json.dumps(meta, sort_keys=True) if meta else "",
    }


def map_outbound_sync_preview_row(doc: dict[str, Any]) -> dict[str, Any]:
    snap = doc.get("payload_snapshot") if isinstance(doc.get("payload_snapshot"), dict) else {}
    raw = json.dumps(snap, sort_keys=True)
    return {
        "target_system": doc.get("target_system"),
        "entity_type": doc.get("entity_type"),
        "entity_id": doc.get("entity_id"),
        "payload_byte_length": len(raw.encode("utf-8")),
        "payload_top_level_keys": ",".join(sorted(snap.keys())),
        "sync_status": doc.get("sync_status") or "pending",
    }
