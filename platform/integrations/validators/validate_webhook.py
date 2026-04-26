from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "inbound_webhook_schema.json"


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(_SCHEMA.read_text(encoding="utf-8")))


def validate_webhook(payload: dict[str, Any]) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    pl = payload.get("payload")
    if pl is not None:
        if not isinstance(pl, dict):
            errs.append("payload must be a JSON object (not array/primitive)")
        else:
            try:
                json.dumps(pl)
            except (TypeError, ValueError):
                errs.append("payload contains non-JSON-serializable values")

    dup_ref = payload.get("duplicate_of_webhook_id")
    ext = payload.get("external_event_id")
    if dup_ref and not ext:
        errs.append("duplicate_of_webhook_id requires external_event_id for idempotent dedup story")

    linkage_keys = (
        "linkage_project_id",
        "linkage_user_id",
        "linkage_recommendation_session_id",
    )
    for k in linkage_keys:
        if k in payload and payload[k] is not None and payload[k] == "":
            errs.append(f"{k} cannot be empty string; omit or provide cuid-like id")

    return ValidationResult(ok=len(errs) == 0, errors=errs)


def webhook_dedup_key(payload: dict[str, Any]) -> tuple[str, str] | None:
    """Return (source_system, external_event_id) when duplicate protection can apply."""
    src = payload.get("source_system")
    ext = payload.get("external_event_id")
    if isinstance(src, str) and isinstance(ext, str) and src.strip() and ext.strip():
        return (src.strip(), ext.strip())
    return None
