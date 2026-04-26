"""
Explicit promotion gates: PASS | PASS_TO_STAGING_ONLY | REJECT.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any


class PromotionResult(str, Enum):
    PASS = "PASS"
    PASS_TO_STAGING_ONLY = "PASS_TO_STAGING_ONLY"
    REJECT = "REJECT"


@dataclass
class GateConfig:
    """Thresholds (v1 defaults; tune per task)."""

    min_mae_improvement_vs_baseline: float = 0.0  # require candidate MAE <= baseline_mae - this (lower MAE is better)
    max_mae_regression_vs_production: float = 0.03
    min_r2_gain_vs_baseline: float = 0.0
    min_ndcg_gain_vs_baseline: float = 0.0
    min_post_install_rows_for_production: int = 50
    min_val_rows: int = 20


def _val_regression(metrics: dict[str, Any]) -> tuple[float | None, float | None]:
    v = metrics.get("val") or {}
    return v.get("mae"), v.get("r2")


def evaluate_gates(
    task: str,
    candidate_metrics: dict[str, Any],
    baseline_metrics: dict[str, Any] | None,
    production_metrics: dict[str, Any] | None,
    *,
    source_mix: dict[str, Any],
    artifact_paths: dict[str, str],
    cfg: GateConfig | None = None,
) -> tuple[PromotionResult, list[str]]:
    cfg = cfg or GateConfig()
    reasons: list[str] = []

    required = ("model.joblib", "feature_manifest.json", "metrics.json")
    for key in required:
        if key not in artifact_paths or not Path(artifact_paths[key]).is_file():
            reasons.append(f"missing_artifact:{key}")
            return PromotionResult.REJECT, reasons

    post_n = 0
    if "by_tier" in source_mix:
        post_n = int(source_mix["by_tier"].get("post_install_validated", 0))

    if task in ("feasibility", "heat_score"):
        c_mae, c_r2 = _val_regression(candidate_metrics)
        if c_mae is None:
            reasons.append("no_val_metrics")
            return PromotionResult.REJECT, reasons

        if baseline_metrics:
            b_mae, b_r2 = _val_regression(baseline_metrics)
            if b_mae is not None and c_mae > b_mae - cfg.min_mae_improvement_vs_baseline:
                reasons.append("mae_not_better_than_baseline")
            if b_r2 is not None and c_r2 is not None and c_r2 < b_r2 + cfg.min_r2_gain_vs_baseline:
                reasons.append("r2_not_better_than_baseline")

        if production_metrics:
            p_mae, _ = _val_regression(production_metrics)
            if p_mae is not None and c_mae > p_mae + cfg.max_mae_regression_vs_production:
                reasons.append("regression_vs_production_mae")

    if task == "ranking":
        c_ndcg = (candidate_metrics.get("listwise") or {}).get("val", {}).get("ndcg_at_5")
        b_ndcg = (baseline_metrics or {}).get("listwise", {}).get("val", {}).get("ndcg_at_5") if baseline_metrics else None
        if c_ndcg is None:
            reasons.append("no_listwise_val")
            return PromotionResult.REJECT, reasons
        if b_ndcg is not None and c_ndcg < float(b_ndcg) + cfg.min_ndcg_gain_vs_baseline:
            reasons.append("ndcg_not_better_than_baseline")

    if reasons:
        return PromotionResult.REJECT, reasons

    if post_n < cfg.min_post_install_rows_for_production:
        return PromotionResult.PASS_TO_STAGING_ONLY, [
            f"post_install_rows_{post_n}_below_production_threshold_{cfg.min_post_install_rows_for_production}",
        ]

    return PromotionResult.PASS, []
