from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from reporting_intelligence.section_blueprint import SECTION_KEYS

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "report_explanation_schema.json"

_VALID_CONFIDENCE = frozenset({"low", "medium", "high"})


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(_SCHEMA.read_text(encoding="utf-8")))


def validate_report_explanation(payload: dict[str, Any]) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    cb = payload.get("confidence_band")
    if cb is not None and cb not in _VALID_CONFIDENCE:
        errs.append("confidence_band must be low|medium|high when set")

    rk = payload.get("related_section_key")
    if isinstance(rk, str) and rk not in SECTION_KEYS:
        errs.append(f"related_section_key must be a known section key, got {rk!r}")

    raw = payload.get("explanation_payload_json")
    if isinstance(raw, str):
        try:
            obj = json.loads(raw)
            if not isinstance(obj, dict):
                errs.append("explanation_payload_json must decode to object")
        except json.JSONDecodeError as e:
            errs.append(f"explanation_payload_json invalid JSON: {e}")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
