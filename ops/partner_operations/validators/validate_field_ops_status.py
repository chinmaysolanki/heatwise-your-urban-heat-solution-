from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "field_ops_status_schema.json"


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(_SCHEMA.read_text(encoding="utf-8")))


def validate_field_ops_status(payload: dict[str, Any]) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    gaps = payload.get("coverage_gaps")
    if gaps is not None and not isinstance(gaps, list):
        errs.append("coverage_gaps must be an array when present")

    rr = payload.get("regional_readiness")
    if rr is not None:
        if not isinstance(rr, dict):
            errs.append("regional_readiness must be an object")
        else:
            try:
                json.dumps(rr)
            except (TypeError, ValueError):
                errs.append("regional_readiness not JSON-serializable")

    notes = payload.get("signal_notes")
    if notes is not None and not isinstance(notes, dict):
        errs.append("signal_notes must be an object when present")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
