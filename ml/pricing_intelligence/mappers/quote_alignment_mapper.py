from __future__ import annotations

from typing import Any


def map_quote_alignment_features(row: dict[str, Any]) -> dict[str, float | int | str | None]:
    """Features for quote accuracy models."""
    pred = row.get("predicted_install_cost_median_inr")
    quote = row.get("quoted_install_cost_inr")
    final = row.get("final_install_cost_inr")
    return {
        "quote_comparison_id": str(row.get("quote_comparison_id") or ""),
        "project_id": str(row.get("project_id") or ""),
        "pred_median": float(pred) if pred is not None else None,
        "quoted": float(quote) if quote is not None else None,
        "final_cost": float(final) if final is not None else None,
        "pricing_accuracy_band": row.get("pricing_accuracy_band"),
    }
