from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "integration_event_schema.json"


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(_SCHEMA.read_text(encoding="utf-8")))


def validate_integration_event(payload: dict[str, Any]) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    pl = payload.get("payload")
    if pl is not None and not isinstance(pl, dict):
        errs.append("payload must be an object when present")

    meta = payload.get("metadata")
    if meta is not None and not isinstance(meta, dict):
        errs.append("metadata must be an object when present")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
