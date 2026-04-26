"""
Install outcome payload validation (partial real-world data safe).
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from validators.validate_project_payload import ValidationResult

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "install_outcome_schema.json"

MAX_ABS_TEMP_C = 25.0


def validate_install_outcome_payload(payload: dict[str, Any]) -> ValidationResult:
    spec = json.loads(_SCHEMA.read_text(encoding="utf-8"))
    v = Draft202012Validator(spec)
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    st = payload.get("install_status")
    if st == "completed":
        if not payload.get("install_date"):
            errs.append("install_status=completed requires install_date")

    for key in ("plant_survival_rate_30d", "plant_survival_rate_90d"):
        val = payload.get(key)
        if val is not None and (val < 0 or val > 1):
            errs.append(f"{key} must be in [0,1]")

    for key in ("measured_temp_change_c", "measured_surface_temp_change_c"):
        val = payload.get(key)
        if val is not None and abs(float(val)) > MAX_ABS_TEMP_C:
            errs.append(f"{key}: magnitude exceeds plausible cap ({MAX_ABS_TEMP_C}°C)")

    idate = payload.get("install_date")
    if idate:
        try:
            datetime.fromisoformat(str(idate).replace("Z", "+00:00"))
        except ValueError:
            errs.append("install_date: not parseable ISO-8601")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
