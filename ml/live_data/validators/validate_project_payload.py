"""
Validate project ingestion snapshots and recommendation session create payloads.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA_INGESTION = _ROOT / "schemas" / "project_ingestion_schema.json"
_SCHEMA_SESSION = _ROOT / "schemas" / "recommendation_event_schema.json"


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator(path: Path) -> Draft202012Validator:
    spec = json.loads(path.read_text(encoding="utf-8"))
    return Draft202012Validator(spec)


def validate_project_ingestion_payload(payload: dict[str, Any]) -> ValidationResult:
    v = _validator(_SCHEMA_INGESTION)
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]
    return ValidationResult(ok=len(errs) == 0, errors=errs)


def validate_recommendation_session_payload(payload: dict[str, Any]) -> ValidationResult:
    v = _validator(_SCHEMA_SESSION)
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    if not errs:
        n = len(payload.get("candidates") or [])
        if payload.get("total_candidates") != n:
            errs.append("total_candidates must equal len(candidates)")
        ranks = [c.get("candidate_rank") for c in payload.get("candidates") or []]
        if len(ranks) != len(set(ranks)):
            errs.append("duplicate candidate_rank in candidates")
        if any(not isinstance(r, int) or r < 1 for r in ranks):
            errs.append("candidate_rank must be positive integers")

    return ValidationResult(ok=len(errs) == 0, errors=errs)


def duplicate_event_protection_hook(
    seen_feedback_ids: set[str],
    feedback_event_id: str,
) -> ValidationResult:
    """Call before insert; reject if id already seen in batch."""
    if feedback_event_id in seen_feedback_ids:
        return ValidationResult(ok=False, errors=[f"duplicate feedback_event_id in batch: {feedback_event_id}"])
    seen_feedback_ids.add(feedback_event_id)
    return ValidationResult(ok=True)
