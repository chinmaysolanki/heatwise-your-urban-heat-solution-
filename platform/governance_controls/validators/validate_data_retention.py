from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "data_retention_schema.json"


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(_SCHEMA.read_text(encoding="utf-8")))


def validate_data_retention(payload: dict[str, Any]) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    arch = payload.get("archive_after_days")
    hard = payload.get("hard_delete_after_days")
    if arch is not None and hard is not None and isinstance(arch, int) and isinstance(hard, int):
        if hard < arch:
            errs.append("hard_delete_after_days must be >= archive_after_days")

    notes = payload.get("notes")
    if notes is not None:
        if not isinstance(notes, dict):
            errs.append("notes must be an object when present")
        else:
            try:
                json.dumps(notes)
            except (TypeError, ValueError):
                errs.append("notes not JSON-serializable")

    return ValidationResult(ok=len(errs) == 0, errors=errs)
