"""
Validate microclimate_snapshot payloads.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "microclimate_snapshot_schema.json"


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    spec = json.loads(_SCHEMA.read_text(encoding="utf-8"))
    return Draft202012Validator(spec)


def validate_microclimate_snapshot(payload: dict[str, Any]) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    m = payload.get("month_of_year")
    if m is not None and isinstance(m, int) and not (1 <= m <= 12):
        errs.append("month_of_year must be 1–12")

    sc = payload.get("source_confidence")
    if isinstance(sc, (int, float)) and not (0.0 <= float(sc) <= 1.0):
        errs.append("source_confidence out of [0,1]")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
