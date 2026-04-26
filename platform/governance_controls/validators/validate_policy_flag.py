from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "policy_flag_schema.json"


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(_SCHEMA.read_text(encoding="utf-8")))


def validate_policy_flag(payload: dict[str, Any]) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    for key in ("detail", "metadata"):
        val = payload.get(key)
        if val is not None:
            if not isinstance(val, dict):
                errs.append(f"{key} must be an object when present")
            else:
                try:
                    json.dumps(val)
                except (TypeError, ValueError):
                    errs.append(f"{key} not JSON-serializable")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
