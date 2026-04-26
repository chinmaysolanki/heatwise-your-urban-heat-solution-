from __future__ import annotations

from typing import Any


def validate_pricing_input_record(row: dict[str, Any]) -> list[str]:
    errs: list[str] = []
    if not isinstance(row.get("project_snapshot"), dict):
        errs.append("project_snapshot must be object")
    if not isinstance(row.get("candidate_snapshot"), dict):
        errs.append("candidate_snapshot must be object")
    for key in ("supply_readiness_score", "installer_readiness_score"):
        v = row.get(key)
        if v is not None:
            try:
                f = float(v)
                if not 0 <= f <= 1:
                    errs.append(f"{key} must be in [0,1]")
            except (TypeError, ValueError):
                errs.append(f"invalid {key}")
    return errs
