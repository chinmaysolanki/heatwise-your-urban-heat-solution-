from __future__ import annotations

import json
from typing import Any


_AVAIL = frozenset({"available", "limited", "backorder", "unavailable"})


def _parse_substitutes(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if isinstance(data, list):
        return [str(x) for x in data if x]
    if isinstance(data, dict) and "species" in data:
        v = data["species"]
        if isinstance(v, list):
            return [str(x) for x in v if x]
    return []


def substitute_cycle_exists(species: str, substitutes_json: str | None) -> bool:
    """Detect a trivial self-cycle or 2-node cycle in substitute list order."""
    subs = _parse_substitutes(substitutes_json)
    n0 = species.strip().lower()
    for s in subs:
        if s.strip().lower() == n0:
            return True
    for i, a in enumerate(subs):
        for b in subs[i + 1 :]:
            if a.strip().lower() == n0 and b.strip().lower() == n0:
                return True
    return False


def validate_species_availability_record(row: dict[str, Any]) -> list[str]:
    errs: list[str] = []
    if not str(row.get("availability_id") or "").strip():
        errs.append("missing availability_id")
    name = str(row.get("species_name") or "").strip()
    if not name:
        errs.append("missing species_name")
    if not str(row.get("region") or "").strip():
        errs.append("missing region")
    st = str(row.get("availability_status") or "")
    if st not in _AVAIL:
        errs.append(f"invalid availability_status: {st!r}")
    try:
        c = float(row.get("availability_confidence"))
        if not 0 <= c <= 1:
            errs.append("availability_confidence must be in [0,1]")
    except (TypeError, ValueError):
        errs.append("invalid availability_confidence")
    lt = row.get("estimated_lead_time_days")
    if lt is not None:
        try:
            if int(lt) < 0:
                errs.append("estimated_lead_time_days must be >= 0")
        except (TypeError, ValueError):
            errs.append("invalid estimated_lead_time_days")
    raw_sub = row.get("substitute_species_json")
    if raw_sub is not None and isinstance(raw_sub, str) and raw_sub.strip():
        try:
            json.loads(raw_sub)
        except json.JSONDecodeError:
            errs.append("substitute_species_json is not valid JSON")
        else:
            if name and substitute_cycle_exists(name, raw_sub):
                errs.append("substitute_species_json references primary species (cycle risk)")
    return errs
