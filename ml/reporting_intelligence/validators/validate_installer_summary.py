from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "installer_summary_schema.json"


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(_SCHEMA.read_text(encoding="utf-8")))


def validate_installer_summary(payload: dict[str, Any]) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]
    for field_name in ("execution_payload_json", "readiness_checklist_json"):
        raw = payload.get(field_name)
        if raw is None:
            continue
        if not isinstance(raw, str):
            errs.append(f"{field_name} must be string when set")
            continue
        try:
            json.loads(raw)
        except json.JSONDecodeError as e:
            errs.append(f"{field_name} invalid JSON: {e}")
    return ValidationResult(ok=len(errs) == 0, errors=errs)
