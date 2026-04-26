from __future__ import annotations

from typing import Any


def map_to_cost_outcome_row(row: dict[str, Any]) -> dict[str, float | str]:
    """Training target row joined with estimate id."""
    return {
        "cost_estimate_id": str(row.get("cost_estimate_id") or ""),
        "quoted_install_cost_inr": float(row.get("quoted_install_cost_inr") or 0),
        "final_install_cost_inr": float(row.get("final_install_cost_inr") or 0),
        "estimate_error_pct": float(row.get("install_cost_error_pct") or 0),
        "budget_fit_outcome": str(row.get("budget_fit_band") or ""),
    }
