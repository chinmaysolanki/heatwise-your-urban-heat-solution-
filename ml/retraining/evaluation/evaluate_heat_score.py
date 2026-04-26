"""Heat score evaluation with subgroup breakdowns."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

import sys

_ML = Path(__file__).resolve().parents[2]
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

from training.evaluation.metrics import regression_report


def subgroup_regression_metrics(
    frame: pd.DataFrame,
    y_col: str,
    pred: np.ndarray,
    subgroup_cols: list[str],
) -> dict[str, Any]:
    """Requires ``frame`` aligned row-wise with ``pred`` and ``y_col``."""
    out: dict[str, Any] = {}
    f = frame.reset_index(drop=True).copy()
    f["_pred"] = pred
    f["_y"] = f[y_col].values
    for col in subgroup_cols:
        if col not in f.columns:
            continue
        sub: dict[str, Any] = {}
        for g, part in f.groupby(col, dropna=False):
            yt = part["_y"].dropna().values.astype(np.float64)
            pr = part.loc[part["_y"].notna(), "_pred"].values.astype(np.float64)
            if len(yt) < 3:
                continue
            sub[str(g)] = regression_report(yt, pr)
        if sub:
            out[col] = sub
    return out


def evaluate_heat_score_split(
    frame: pd.DataFrame,
    y_col: str,
    y_pred: np.ndarray,
) -> dict[str, Any]:
    y = frame[y_col].dropna().values.astype(np.float64)
    mask = frame[y_col].notna().values
    pred = y_pred[mask]
    base = regression_report(y, pred)
    base["subgroups"] = subgroup_regression_metrics(
        frame.loc[mask].reset_index(drop=True),
        y_col,
        pred,
        ["project_type", "climate_zone"],
    )
    return base
