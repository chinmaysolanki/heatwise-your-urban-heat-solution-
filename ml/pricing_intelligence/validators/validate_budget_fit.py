from __future__ import annotations

from typing import Any


_BANDS = frozenset(
    {
        "comfortably_within_budget",
        "near_budget_limit",
        "stretch_required",
        "over_budget",
        "high_uncertainty",
    },
)
_RISK = frozenset({"low", "medium", "high"})


def validate_budget_fit_record(row: dict[str, Any]) -> list[str]:
    errs: list[str] = []
    for key in ("budget_fit_id", "project_id"):
        if not str(row.get(key) or "").strip():
            errs.append(f"missing {key}")
    try:
        ub = float(row.get("user_budget_inr"))
        if ub < 0:
            errs.append("user_budget_inr must be nonnegative")
    except (TypeError, ValueError):
        errs.append("invalid user_budget_inr")

    try:
        med = float(row.get("estimated_install_cost_median_inr"))
        mx = float(row.get("estimated_install_cost_max_inr"))
        if med < 0 or mx < 0:
            errs.append("estimated costs must be nonnegative")
        if med > mx:
            errs.append("median install estimate cannot exceed max")
    except (TypeError, ValueError):
        errs.append("invalid install cost fields")

    band = str(row.get("budget_fit_band") or "")
    if band not in _BANDS:
        errs.append("invalid budget_fit_band")

    stretch = row.get("stretch_budget_required")
    if band == "over_budget" and stretch is True:
        errs.append("over_budget band should not set stretch_budget_required=true")
    if band == "stretch_required" and stretch is not True:
        errs.append("stretch_required band expects stretch_budget_required=true")

    if str(row.get("affordability_risk_level") or "") not in _RISK:
        errs.append("invalid affordability_risk_level")

    try:
        s = float(row.get("budget_fit_score"))
        if not 0 <= s <= 1:
            errs.append("budget_fit_score must be in [0,1]")
    except (TypeError, ValueError):
        errs.append("invalid budget_fit_score")

    return errs
