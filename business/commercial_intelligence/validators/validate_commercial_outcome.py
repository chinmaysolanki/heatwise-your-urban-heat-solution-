from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "commercial_outcome_schema.json"


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(_SCHEMA.read_text(encoding="utf-8")))


def _parse_dt(x: Any) -> datetime | None:
    if not x:
        return None
    try:
        return datetime.fromisoformat(str(x).replace("Z", "+00:00"))
    except ValueError:
        return None


def validate_commercial_outcome(payload: dict[str, Any]) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    pairs = [
        ("first_quote_received_at", "quote_accepted_at"),
        ("quote_accepted_at", "install_completed_at"),
    ]
    for a, b in pairs:
        ta, tb = _parse_dt(payload.get(a)), _parse_dt(payload.get(b))
        if ta and tb and tb < ta:
            errs.append(f"{b} cannot precede {a}")

    inst = _parse_dt(payload.get("install_completed_at"))
    fr = _parse_dt(payload.get("first_recommendation_at"))
    if inst and fr and inst < fr:
        errs.append("install_completed_at cannot precede first_recommendation_at")

    margin = payload.get("platform_margin_inr")
    net = payload.get("net_revenue_inr")
    if (
        margin is not None
        and net is not None
        and isinstance(margin, (int, float))
        and isinstance(net, (int, float))
        and net >= 0
        and margin > net + 1e-3
    ):
        errs.append("platform_margin_inr should not exceed net_revenue_inr without explanation")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
