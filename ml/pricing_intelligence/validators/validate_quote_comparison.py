from __future__ import annotations

import json
from typing import Any


def validate_quote_comparison_record(row: dict[str, Any]) -> list[str]:
    errs: list[str] = []
    if not str(row.get("quote_comparison_id") or "").strip():
        errs.append("missing quote_comparison_id")
    if not str(row.get("project_id") or "").strip():
        errs.append("missing project_id")

    fin = row.get("final_install_cost_inr")
    job = row.get("install_job_id")
    if fin is not None and not job:
        errs.append("final_install_cost_inr should be paired with install_job_id context")

    for key in ("install_cost_error_pct", "quote_to_final_delta_pct", "maintenance_prediction_error_pct"):
        v = row.get(key)
        if v is not None:
            try:
                float(v)
            except (TypeError, ValueError):
                errs.append(f"invalid {key}")

    raw = row.get("cost_risk_flags_json")
    if raw is not None and isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
            if not isinstance(parsed, list):
                errs.append("cost_risk_flags_json must be JSON array")
        except json.JSONDecodeError:
            errs.append("cost_risk_flags_json invalid JSON")

    return errs
