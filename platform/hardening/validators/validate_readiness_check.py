from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "readiness_check_schema.json"


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(_SCHEMA.read_text(encoding="utf-8")))


def validate_readiness_check(payload: dict[str, Any]) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    lat = payload.get("latency_ms")
    if lat is not None and isinstance(lat, float) and lat != lat:  # NaN
        errs.append("latency_ms cannot be NaN")

    det = payload.get("details")
    if det is not None:
        if not isinstance(det, dict):
            errs.append("details must be an object when present")
        else:
            try:
                json.dumps(det)
            except (TypeError, ValueError):
                errs.append("details is not JSON-serializable")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
