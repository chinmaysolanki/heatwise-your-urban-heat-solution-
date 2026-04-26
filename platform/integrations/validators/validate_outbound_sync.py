from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "outbound_sync_schema.json"


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(_SCHEMA.read_text(encoding="utf-8")))


def _parse_iso(label: str, s: str | None) -> datetime | None:
    if s is None:
        return None
    raw = s.strip()
    if not raw.endswith("Z") and "+" not in raw and raw.count("-") >= 3:
        pass
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def validate_outbound_sync(payload: dict[str, Any], *, now: datetime | None = None) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    snap = payload.get("payload_snapshot")
    if snap is not None and not isinstance(snap, dict):
        errs.append("payload_snapshot must be an object")

    ac = payload.get("attempt_count")
    if ac is not None and isinstance(ac, (int, float)) and int(ac) < 0:
        errs.append("attempt_count cannot be negative")

    for key in ("last_attempt_at", "next_retry_at"):
        val = payload.get(key)
        if val is None:
            continue
        if not isinstance(val, str):
            errs.append(f"{key} must be ISO-8601 string")
            continue
        parsed = _parse_iso(key, val)
        if parsed is None:
            errs.append(f"{key} is not a valid ISO-8601 timestamp")
            continue
        if key == "next_retry_at" and now is not None:
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            n = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
            skew = 120.0
            if (n.timestamp() - parsed.timestamp()) > skew:
                errs.append("next_retry_at must not be far in the past relative to validation clock")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
