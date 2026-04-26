from __future__ import annotations

import json
from typing import Any


def map_readiness_check_to_row(doc: dict[str, Any]) -> dict[str, Any]:
    det = doc.get("details") if isinstance(doc.get("details"), dict) else {}
    return {
        "check_id": doc.get("check_id"),
        "subsystem": doc.get("subsystem"),
        "status": doc.get("status"),
        "latency_ms": doc.get("latency_ms"),
        "message": doc.get("message"),
        "details_json": json.dumps(det, sort_keys=True) if det else "",
    }
