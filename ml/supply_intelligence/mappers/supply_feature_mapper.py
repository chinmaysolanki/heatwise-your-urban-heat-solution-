from __future__ import annotations

from typing import Any


def species_row_to_features(row: dict[str, Any]) -> dict[str, float | int | str]:
    """ML-ready features from a species availability row (snake_case keys)."""
    status = str(row.get("availability_status") or "unknown")
    conf = float(row.get("availability_confidence") or 0.0)
    lt = row.get("estimated_lead_time_days")
    lt_val = float(lt) if lt is not None else 0.0
    return {
        "species_local_availability_score": conf if status == "available" else conf * 0.7,
        "material_lead_time_risk": min(1.0, lt_val / 45.0),
        "availability_status_encoding": _status_bucket(status),
        "region": str(row.get("region") or ""),
        "species_name": str(row.get("species_name") or ""),
    }


def _status_bucket(status: str) -> float:
    return {"available": 1.0, "limited": 0.6, "backorder": 0.35, "unavailable": 0.0}.get(status, 0.5)
