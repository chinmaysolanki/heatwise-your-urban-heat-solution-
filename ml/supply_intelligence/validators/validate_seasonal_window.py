from __future__ import annotations

from typing import Any


_SUIT = frozenset({"optimal", "acceptable", "marginal", "unsuitable"})


def month_range_valid(start_month: int, end_month: int) -> bool:
    return 1 <= start_month <= 12 and 1 <= end_month <= 12


def validate_seasonal_window_record(row: dict[str, Any]) -> list[str]:
    errs: list[str] = []
    if not str(row.get("seasonal_window_id") or "").strip():
        errs.append("missing seasonal_window_id")
    if not str(row.get("region") or "").strip():
        errs.append("missing region")
    if not str(row.get("climate_zone") or "").strip():
        errs.append("missing climate_zone (required for seasonal mapping)")
    try:
        sm = int(row.get("start_month"))
        em = int(row.get("end_month"))
    except (TypeError, ValueError):
        errs.append("start_month and end_month must be integers")
        sm, em = 0, 0
    if not month_range_valid(sm, em):
        errs.append("start_month/end_month must each be in 1..12")
    sl = str(row.get("suitability_level") or "")
    if sl not in _SUIT:
        errs.append(f"invalid suitability_level: {sl!r}")
    return errs
