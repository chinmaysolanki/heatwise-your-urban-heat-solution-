from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "variant_performance_schema.json"


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(_SCHEMA.read_text(encoding="utf-8")))


def validate_variant_performance(payload: dict[str, Any]) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    try:
        ws = datetime.fromisoformat(str(payload.get("window_start", "")).replace("Z", "+00:00"))
        we = datetime.fromisoformat(str(payload.get("window_end", "")).replace("Z", "+00:00"))
        if ws >= we:
            errs.append("window_start must be before window_end")
    except ValueError:
        errs.append("invalid window_start or window_end")

    for fld in ("avg_blended_score", "avg_latency_ms"):
        x = payload.get(fld)
        if x is not None and isinstance(x, (int, float)):
            if fld == "avg_blended_score" and (float(x) < 0 or float(x) > 1.0001):
                errs.append(f"{fld} implausible outside [0,1] for normalized score")
            if fld == "avg_latency_ms" and float(x) < 0:
                errs.append(f"{fld} cannot be negative")

    meta = payload.get("metadata_json")
    if isinstance(meta, str) and meta.strip():
        try:
            json.loads(meta)
        except json.JSONDecodeError as e:
            errs.append(f"metadata_json invalid JSON: {e}")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
