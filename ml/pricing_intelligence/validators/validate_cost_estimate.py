from __future__ import annotations

from typing import Any


_CONF = frozenset({"tight", "medium", "wide", "very_wide"})
_SRC = frozenset({"rules", "hybrid", "ml", "installer_benchmark"})


def validate_cost_estimate_record(row: dict[str, Any]) -> list[str]:
    errs: list[str] = []
    if not str(row.get("cost_estimate_id") or "").strip():
        errs.append("missing cost_estimate_id")
    for key in ("region", "climate_zone", "project_type", "solution_type"):
        if not str(row.get(key) or "").strip():
            errs.append(f"missing {key}")
    if str(row.get("estimate_source") or "") not in _SRC:
        errs.append("invalid estimate_source")
    if str(row.get("estimate_confidence_band") or "") not in _CONF:
        errs.append("invalid estimate_confidence_band")
    try:
        v = float(row.get("quote_volatility_score"))
        if not 0 <= v <= 1:
            errs.append("quote_volatility_score must be in [0,1]")
    except (TypeError, ValueError):
        errs.append("invalid quote_volatility_score")

    def triplet(lo: str, med: str, hi: str, label: str) -> None:
        try:
            a, b, c = float(row.get(lo)), float(row.get(med)), float(row.get(hi))
            if min(a, b, c) < 0:
                errs.append(f"{label} costs must be nonnegative")
            if not a <= b <= c:
                errs.append(f"{label}: require min <= median <= max")
        except (TypeError, ValueError):
            errs.append(f"invalid {label} cost triple")

    triplet(
        "estimated_install_cost_min_inr",
        "estimated_install_cost_median_inr",
        "estimated_install_cost_max_inr",
        "install",
    )
    triplet(
        "estimated_annual_maintenance_min_inr",
        "estimated_annual_maintenance_median_inr",
        "estimated_annual_maintenance_max_inr",
        "maintenance",
    )

    ct = row.get("contingency_pct")
    if ct is not None:
        try:
            c = float(ct)
            if not 0 <= c <= 100:
                errs.append("contingency_pct must be in [0,100]")
        except (TypeError, ValueError):
            errs.append("invalid contingency_pct")

    bfs = row.get("budget_fit_score")
    if bfs is not None:
        try:
            bf = float(bfs)
            if not 0 <= bf <= 1:
                errs.append("budget_fit_score must be in [0,1]")
        except (TypeError, ValueError):
            errs.append("invalid budget_fit_score")

    return errs
