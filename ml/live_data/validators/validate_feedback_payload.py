"""
Validate feedback / telemetry events (explicit + implicit).
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from validators.validate_project_payload import ValidationResult

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "feedback_event_schema.json"

REQUIRES_CANDIDATE_HINT = frozenset(
    {
        "recommendation_select",
        "candidate_selected",
        "recommendation_save",
        "recommendation_unsave",
        "recommendation_expand",
        "recommendation_compare",
    },
)


def validate_feedback_payload(payload: dict[str, Any]) -> ValidationResult:
    spec = json.loads(_SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(spec)
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    ts = payload.get("event_timestamp")
    if ts:
        try:
            datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        except ValueError:
            errs.append("event_timestamp: not parseable ISO-8601")

    et = payload.get("event_type")
    if et in REQUIRES_CANDIDATE_HINT and not payload.get("candidate_snapshot_id"):
        errs.append(
            f"event_type {et}: candidate_snapshot_id should be set for training-quality rows",
        )

    dwell = payload.get("dwell_time_ms")
    if dwell is not None and dwell < 0:
        errs.append("dwell_time_ms must be non-negative")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
