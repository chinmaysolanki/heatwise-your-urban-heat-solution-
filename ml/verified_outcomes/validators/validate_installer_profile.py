from __future__ import annotations

import json
from typing import Any


def validate_installer_profile(row: dict[str, Any]) -> tuple[bool, list[str]]:
    errs: list[str] = []
    if not row.get("installer_id") and not row.get("id"):
        errs.append("missing_installer_id")
    if not row.get("installer_name"):
        errs.append("missing_installer_name")
    for key in (
        "service_regions",
        "supported_project_types",
        "supported_solution_types",
        "supported_budget_bands",
    ):
        v = row.get(key)
        if v is None:
            continue
        if isinstance(v, str):
            try:
                v = json.loads(v)
            except json.JSONDecodeError:
                errs.append(f"invalid_json:{key}")
                continue
        if not isinstance(v, list):
            errs.append(f"{key}_must_be_list")
    min_sq = row.get("min_job_size_sqft", 0)
    if isinstance(min_sq, (int, float)) and min_sq < 0:
        errs.append("min_job_size_negative")
    max_sq = row.get("max_job_size_sqft")
    if max_sq is not None and isinstance(max_sq, (int, float)) and isinstance(min_sq, (int, float)):
        if max_sq < min_sq:
            errs.append("max_job_size_below_min")
    return len(errs) == 0, errs
