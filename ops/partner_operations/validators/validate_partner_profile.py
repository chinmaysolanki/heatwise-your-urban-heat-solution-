from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_PROFILE = _ROOT / "schemas" / "partner_profile_schema.json"
_AREA = _ROOT / "schemas" / "partner_service_area_schema.json"


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _v(path: Path) -> Draft202012Validator:
    return Draft202012Validator(json.loads(path.read_text(encoding="utf-8")))


def validate_partner_profile(payload: dict[str, Any]) -> ValidationResult:
    pv = _v(_PROFILE)
    errs = [f"{e.json_path}: {e.message}" for e in pv.iter_errors(payload)]

    av = _v(_AREA)
    for i, area in enumerate(payload.get("service_areas") or []):
        if not isinstance(area, dict):
            errs.append(f"service_areas[{i}] must be an object")
            continue
        errs.extend([f"service_areas[{i}]{e.json_path}: {e.message}" for e in av.iter_errors(area)])

    for key in ("primary_contact", "metadata"):
        val = payload.get(key)
        if val is not None and not isinstance(val, dict):
            errs.append(f"{key} must be an object when present")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
