from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA_INSIGHT = _ROOT / "schemas" / "recommendation_insight_schema.json"
_SCHEMA_LESSON = _ROOT / "schemas" / "lesson_memory_schema.json"

_ALLOWED_SEGMENT_PREFIXES = ("pt:", "cz:", "bb:", "r:", "ut:", "ia:", "pc:")


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _v(path: Path) -> Draft202012Validator:
    return Draft202012Validator(json.loads(path.read_text(encoding="utf-8")))


def validate_recommendation_insight(payload: dict[str, Any]) -> ValidationResult:
    val = _v(_SCHEMA_INSIGHT)
    errs = [f"{e.json_path}: {e.message}" for e in val.iter_errors(payload)]

    try:
        ws = datetime.fromisoformat(str(payload.get("window_start", "")).replace("Z", "+00:00"))
        we = datetime.fromisoformat(str(payload.get("window_end", "")).replace("Z", "+00:00"))
        if ws >= we:
            errs.append("window_start must be before window_end")
    except ValueError:
        errs.append("invalid window_start or window_end")

    for fname in ("metrics_json", "scope_json", "evidence_refs_json", "source_layers_json"):
        raw = payload.get(fname)
        if isinstance(raw, str):
            try:
                json.loads(raw)
            except json.JSONDecodeError as e:
                errs.append(f"{fname} invalid JSON: {e}")

    return ValidationResult(ok=len(errs) == 0, errors=errs)


def validate_lesson_memory_record(payload: dict[str, Any]) -> ValidationResult:
    val = _v(_SCHEMA_LESSON)
    errs = [f"{e.json_path}: {e.message}" for e in val.iter_errors(payload)]

    raw = payload.get("evidence_refs_json")
    if isinstance(raw, str):
        try:
            refs = json.loads(raw)
        except json.JSONDecodeError as e:
            errs.append(f"evidence_refs_json invalid JSON: {e}")
        else:
            if not isinstance(refs, list) or not refs:
                errs.append("evidence_refs_json must be a non-empty array")
            else:
                for i, r in enumerate(refs):
                    if not isinstance(r, dict):
                        errs.append(f"evidence_refs[{i}] must be object")
                        continue
                    if not str(r.get("layer") or "").strip():
                        errs.append(f"evidence_refs[{i}].layer required")
                    if not str(r.get("id") or "").strip():
                        errs.append(f"evidence_refs[{i}].id required")

    sk = payload.get("related_segment_key")
    if isinstance(sk, str) and sk.strip():
        if not any(p in sk for p in _ALLOWED_SEGMENT_PREFIXES):
            errs.append("related_segment_key must contain known dimension prefixes")

    return ValidationResult(ok=len(errs) == 0, errors=errs)


def validate_segment_key_format(segment_key: str) -> ValidationResult:
    errs: list[str] = []
    if not segment_key or not isinstance(segment_key, str):
        errs.append("segment_key required")
        return ValidationResult(ok=False, errors=errs)
    parts = segment_key.split("|")
    if len(parts) < 7:
        errs.append("segment_key must include all dimension tokens (pt:|cz:|bb:|r:|ut:|ia:|pc:)")
    for p in parts:
        ok = any(p.startswith(pref) for pref in _ALLOWED_SEGMENT_PREFIXES)
        if not ok:
            errs.append(f"unknown segment token: {p}")
    return ValidationResult(ok=len(errs) == 0, errors=errs)
