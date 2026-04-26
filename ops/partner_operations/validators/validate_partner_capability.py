from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "partner_capability_schema.json"


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(_SCHEMA.read_text(encoding="utf-8")))


def validate_partner_capability(payload: dict[str, Any]) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    sc = payload.get("seasonal_constraints")
    if sc is not None:
        if not isinstance(sc, dict):
            errs.append("seasonal_constraints must be an object")
        else:
            try:
                json.dumps(sc)
            except (TypeError, ValueError):
                errs.append("seasonal_constraints not JSON-serializable")

    extras = payload.get("matrix_extras")
    if extras is not None and not isinstance(extras, dict):
        errs.append("matrix_extras must be an object when present")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
