from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "revenue_event_schema.json"

_REFUNDISH = frozenset(
    {"refund_issued", "installer_commission_refunded", "subscription_cancelled"},
)


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(_SCHEMA.read_text(encoding="utf-8")))


def validate_revenue_event(payload: dict[str, Any]) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    et = str(payload.get("event_type") or "")
    gross = payload.get("gross_amount")
    net = payload.get("net_amount")
    if gross is not None and isinstance(gross, (int, float)) and gross < 0 and et not in _REFUNDISH:
        errs.append("gross_amount negative only allowed for refund-like event types")
    if (
        gross is not None
        and net is not None
        and isinstance(gross, (int, float))
        and isinstance(net, (int, float))
        and gross >= 0
        and net > gross + 1e-6
        and et not in _REFUNDISH
    ):
        errs.append("net_amount should not exceed gross_amount for normal revenue events")

    for key in (
        "commission_amount",
        "platform_fee_amount",
        "discount_amount",
        "refund_amount",
        "tax_amount",
    ):
        val = payload.get(key)
        if val is not None and isinstance(val, (int, float)) and val < 0:
            errs.append(f"{key} must be non-negative when set")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
