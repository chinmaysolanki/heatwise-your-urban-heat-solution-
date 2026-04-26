"""
Resolve target columns for each task from hybrid / bootstrap-aligned pointwise frames.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class TargetResolution:
    column: str
    kind: str  # "regression" | "binary"
    notes: str


def resolve_feasibility_target(df: pd.DataFrame) -> TargetResolution:
    if "feasibility_score" in df.columns and df["feasibility_score"].notna().any():
        return TargetResolution("feasibility_score", "regression", "bootstrap column")
    # live/hybrid may only have scores on snapshot JSON — optional column
    if "feasibility_score_pred" in df.columns:
        return TargetResolution("feasibility_score_pred", "regression", "derived alias")
    raise ValueError("no feasibility target column found (expected feasibility_score)")


def resolve_heat_target(df: pd.DataFrame) -> TargetResolution:
    if "heat_mitigation_score" in df.columns and df["heat_mitigation_score"].notna().any():
        return TargetResolution("heat_mitigation_score", "regression", "bootstrap column")
    if "pointwise_relevance_score" in df.columns:
        return TargetResolution(
            "pointwise_relevance_score",
            "regression",
            "hybrid proxy when heat_mitigation_score absent",
        )
    if "outcome_success_proxy" in df.columns and df["outcome_success_proxy"].notna().any():
        return TargetResolution(
            "outcome_success_proxy",
            "regression",
            "install/satisfaction proxy for live-heavy sets",
        )
    raise ValueError("no heat / relevance target found")


def resolve_ranking_listwise_target(df: pd.DataFrame) -> TargetResolution:
    if "best_candidate" in df.columns and df["best_candidate"].notna().any():
        return TargetResolution("best_candidate", "binary", "synthetic listwise")
    if "pointwise_binary_relevant" in df.columns:
        return TargetResolution(
            "pointwise_binary_relevant",
            "binary",
            "hybrid explicit/install label",
        )
    raise ValueError("no listwise ranking target (best_candidate or pointwise_binary_relevant)")


def extract_y(df: pd.DataFrame, resolution: TargetResolution) -> tuple[np.ndarray, pd.Series]:
    """Return y array and boolean mask of rows used (drop NaN targets)."""
    col = resolution.column
    if col not in df.columns:
        raise ValueError(f"target column missing: {col}")
    s = df[col]
    mask = s.notna()
    if resolution.kind == "binary":
        y = s[mask].astype(np.int64).values
    else:
        y = s[mask].astype(np.float64).values
    return y, mask


def source_weight_series(df: pd.DataFrame, use_weights: bool) -> np.ndarray | None:
    if not use_weights or df.empty:
        return None
    if "row_weight" in df.columns:
        return df["row_weight"].astype(np.float64).values
    return None
