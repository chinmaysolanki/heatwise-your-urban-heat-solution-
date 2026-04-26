from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "unit_economics_snapshot_schema.json"

_RATE_FIELDS = (
    "quote_request_to_quote_received_rate",
    "quote_received_to_acceptance_rate",
    "acceptance_to_install_rate",
    "install_conversion_rate",
    "refund_rate",
    "repeat_service_rate",
)


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(_SCHEMA.read_text(encoding="utf-8")))


def validate_unit_economics_snapshot(payload: dict[str, Any]) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    try:
        ws = datetime.fromisoformat(str(payload.get("window_start", "")).replace("Z", "+00:00"))
        we = datetime.fromisoformat(str(payload.get("window_end", "")).replace("Z", "+00:00"))
        if ws >= we:
            errs.append("window_start must be before window_end")
    except ValueError:
        errs.append("invalid window_start or window_end")

    for k in _RATE_FIELDS:
        x = payload.get(k)
        if x is not None and isinstance(x, (int, float)) and not (0.0 <= float(x) <= 1.0):
            errs.append(f"{k} must be in [0,1] when set")

    tq = int(payload.get("total_quote_acceptances") or 0)
    tr = int(payload.get("total_quotes_received") or 0)
    if tq > tr:
        errs.append("total_quote_acceptances cannot exceed total_quotes_received")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
