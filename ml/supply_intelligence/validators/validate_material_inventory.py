from __future__ import annotations

import json
from typing import Any


_AVAIL = frozenset({"available", "limited", "backorder", "unavailable"})
_STOCK = frozenset({"high", "medium", "low", "out"})


def validate_material_inventory_record(row: dict[str, Any]) -> list[str]:
    errs: list[str] = []
    for key in ("material_inventory_id", "region", "material_type", "material_name", "supplier_source_type"):
        if not str(row.get(key) or "").strip():
            errs.append(f"missing {key}")
    st = str(row.get("availability_status") or "")
    if st not in _AVAIL:
        errs.append(f"invalid availability_status: {st!r}")
    sb = str(row.get("stock_band") or "")
    if sb not in _STOCK:
        errs.append(f"invalid stock_band: {sb!r}")
    lt = row.get("estimated_lead_time_days")
    if lt is not None:
        try:
            if int(lt) < 0:
                errs.append("estimated_lead_time_days must be >= 0")
        except (TypeError, ValueError):
            errs.append("invalid estimated_lead_time_days")
    sol = row.get("compatible_solution_types")
    if sol is not None:
        if isinstance(sol, str):
            try:
                parsed = json.loads(sol)
            except json.JSONDecodeError:
                errs.append("compatible_solution_types string is not JSON")
            else:
                if not isinstance(parsed, list):
                    errs.append("compatible_solution_types must be a JSON array")
        elif not isinstance(sol, list):
            errs.append("compatible_solution_types must be list or JSON array string")
    return errs
