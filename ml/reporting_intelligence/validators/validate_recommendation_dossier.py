from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from reporting_intelligence.section_blueprint import DOSSIER_REQUIRED_SECTION_KEYS

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = _ROOT / "schemas" / "recommendation_dossier_schema.json"


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)


def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(_SCHEMA.read_text(encoding="utf-8")))


def validate_recommendation_dossier(
    payload: dict[str, Any],
    *,
    section_keys: list[str] | None = None,
) -> ValidationResult:
    v = _validator()
    errs = [f"{e.json_path}: {e.message}" for e in v.iter_errors(payload)]

    try:
        ids = json.loads(str(payload.get("candidate_snapshot_ids_json") or "[]"))
        if not isinstance(ids, list):
            errs.append("candidate_snapshot_ids_json must be a JSON array")
        else:
            sel = payload.get("selected_candidate_snapshot_id")
            if sel is not None and sel not in ids:
                errs.append("selected_candidate_snapshot_id must appear in candidate_snapshot_ids_json")
    except json.JSONDecodeError as e:
        errs.append(f"candidate_snapshot_ids_json invalid JSON: {e}")

    for field_name in (
        "project_context_snapshot_json",
        "recommendation_summary_json",
        "explanation_provenance_json",
    ):
        raw = payload.get(field_name)
        if raw is None:
            continue
        if not isinstance(raw, str):
            errs.append(f"{field_name} must be string")
            continue
        try:
            obj = json.loads(raw)
        except json.JSONDecodeError as e:
            errs.append(f"{field_name} invalid JSON: {e}")
            continue
        if not isinstance(obj, (dict, list)):
            errs.append(f"{field_name} must decode to object or array")

    dtype = str(payload.get("dossier_type") or "")
    if section_keys is not None and dtype in DOSSIER_REQUIRED_SECTION_KEYS:
        missing = DOSSIER_REQUIRED_SECTION_KEYS[dtype] - frozenset(section_keys)
        extra = frozenset(section_keys) - DOSSIER_REQUIRED_SECTION_KEYS[dtype]
        if missing:
            errs.append(f"missing required sections for {dtype}: {sorted(missing)}")
        if extra:
            errs.append(f"unexpected section keys for {dtype}: {sorted(extra)}")

    return ValidationResult(ok=len(errs) == 0, errors=errs)


def validate_section_ordering(sections: list[dict[str, Any]]) -> ValidationResult:
    errs: list[str] = []
    orders = [s.get("section_order") for s in sections]
    if any(not isinstance(o, int) or o < 0 for o in orders):
        errs.append("section_order must be non-negative integers")
    if len(orders) != len(set(orders)):
        errs.append("duplicate section_order values")
    n = len(orders)
    if n and sorted(orders) != list(range(n)):
        errs.append("section_order must be 0..n-1 with no gaps (matches HeatWise blueprint assembly)")
    return ValidationResult(ok=len(errs) == 0, errors=errs)


def validate_dossier_export_bundle(
    dossier: dict[str, Any],
    sections: list[dict[str, Any]],
    explanations: list[dict[str, Any]],
    *,
    validate_section_schemas: bool = True,
) -> ValidationResult:
    from reporting_intelligence.validators.validate_report_explanation import validate_report_explanation
    from reporting_intelligence.validators.validate_report_section import validate_report_section

    keys = [str(s.get("section_key")) for s in sections]
    dres = validate_recommendation_dossier(dossier, section_keys=keys)
    ores = validate_section_ordering(sections)
    errors = list(dres.errors) + list(ores.errors)
    for s in sections:
        if validate_section_schemas:
            sr = validate_report_section(s)
            if not sr.ok:
                errors.extend(sr.errors)
    allowed_keys = frozenset(keys)
    for e in explanations:
        er = validate_report_explanation(e)
        if not er.ok:
            errors.extend(er.errors)
        rel = e.get("related_section_key")
        if rel is not None and rel not in allowed_keys:
            errors.append(f"explanation references unknown section_key {rel!r}")
    return ValidationResult(ok=len(errors) == 0, errors=errors)
