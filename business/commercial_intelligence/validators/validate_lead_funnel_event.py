from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "lead_funnel_event_schema.json"


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(_SCHEMA.read_text(encoding="utf-8")))


def validate_lead_funnel_event(payload: dict[str, Any]) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]
    return ValidationResult(ok=len(errs) == 0, errors=errs)


def validate_funnel_sequence_sorted(events: list[dict[str, Any]]) -> ValidationResult:
    """Events must have funnel_stage + event_timestamp (ISO); stages non-decreasing by time."""
    from datetime import datetime

    from commercial_intelligence.mappers.funnel_mapper import FUNNEL_STAGE_ORDER

    errs: list[str] = []
    try:
        chain = sorted(
            events,
            key=lambda e: datetime.fromisoformat(str(e.get("event_timestamp", "")).replace("Z", "+00:00")),
        )
    except Exception:
        return ValidationResult(ok=False, errors=["invalid event_timestamp in sequence"])

    for i in range(1, len(chain)):
        s0 = str(chain[i - 1].get("funnel_stage") or "")
        s1 = str(chain[i].get("funnel_stage") or "")
        o0 = FUNNEL_STAGE_ORDER.get(s0, -1)
        o1 = FUNNEL_STAGE_ORDER.get(s1, -1)
        if o1 < o0:
            errs.append(f"impossible funnel order: {s0} -> {s1} by timestamp")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
