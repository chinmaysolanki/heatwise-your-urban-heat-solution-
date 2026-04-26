"""
Validate site_exposure_profile payloads and impossible combinations.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "site_exposure_schema.json"

@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    spec = json.loads(_SCHEMA.read_text(encoding="utf-8"))
    return Draft202012Validator(spec)


def validate_site_exposure(payload: dict[str, Any]) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    sun = payload.get("sunlight_hours")
    if sun is not None and isinstance(sun, (int, float)) and (float(sun) < 0 or float(sun) > 24):
        errs.append("sunlight_hours must be in [0,24]")

    fl = payload.get("floor_level")
    if fl is not None and isinstance(fl, int) and fl < -5:
        errs.append("floor_level implausibly low (< -5)")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
