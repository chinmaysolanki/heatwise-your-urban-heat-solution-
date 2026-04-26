"""
Validate geo_enrichment_snapshot: schema + parseable JSON payloads.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "geo_enrichment_schema.json"


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    spec = json.loads(_SCHEMA.read_text(encoding="utf-8"))
    return Draft202012Validator(spec)


def validate_geo_enrichment(payload: dict[str, Any]) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    oc = payload.get("overall_geo_confidence")
    if isinstance(oc, (int, float)) and not (0.0 <= float(oc) <= 1.0):
        errs.append("overall_geo_confidence out of [0,1]")

    for key in ("geo_feature_payload_json", "microclimate_feature_payload_json", "site_exposure_payload_json"):
        raw = payload.get(key)
        if raw is None:
            errs.append(f"missing {key}")
            continue
        if not isinstance(raw, str):
            errs.append(f"{key} must be JSON string")
            continue
        try:
            obj = json.loads(raw)
        except json.JSONDecodeError as e:
            errs.append(f"{key} invalid JSON: {e}")
            continue
        if not isinstance(obj, dict):
            errs.append(f"{key} must decode to object")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
