from __future__ import annotations

import json
from typing import Any


def map_delivery_status_to_row(doc: dict[str, Any]) -> dict[str, Any]:
    detail = doc.get("last_status_detail") if isinstance(doc.get("last_status_detail"), dict) else {}
    meta = doc.get("metadata") if isinstance(doc.get("metadata"), dict) else {}
    return {
        "delivery_type": doc.get("delivery_type"),
        "channel": doc.get("channel"),
        "target_ref": doc.get("target_ref"),
        "related_entity_type": doc.get("related_entity_type"),
        "related_entity_id": doc.get("related_entity_id"),
        "delivery_status": doc.get("delivery_status"),
        "attempt_count": doc.get("attempt_count", 0),
        "correlation_id": doc.get("correlation_id"),
        "outbound_sync_id": doc.get("outbound_sync_id"),
        "last_status_detail_json": json.dumps(detail, sort_keys=True) if detail else "",
        "metadata_json": json.dumps(meta, sort_keys=True) if meta else "",
    }
