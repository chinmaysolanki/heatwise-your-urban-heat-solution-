"""Feasibility regression evaluation extensions (buckets)."""

from __future__ import annotations

import numpy as np
import pandas as pd

import sys
from pathlib import Path

_ML = Path(__file__).resolve().parents[2]
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

from training.evaluation.metrics import regression_report


def bucket_calibration_summary(y_true: np.ndarray, y_pred: np.ndarray, n_buckets: int = 5) -> list[dict[str, float]]:
    y_true = np.asarray(y_true, dtype=np.float64).ravel()
    y_pred = np.asarray(y_pred, dtype=np.float64).ravel()
    qs = np.linspace(0, 1, n_buckets + 1)
    edges = np.quantile(y_pred, qs)
    rows: list[dict[str, float]] = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (y_pred >= lo) & (y_pred <= hi + 1e-9)
        if not m.any():
            continue
        rows.append(
            {
                "pred_lo": float(lo),
                "pred_hi": float(hi),
                "n": float(m.sum()),
                "mean_pred": float(y_pred[m].mean()),
                "mean_true": float(y_true[m].mean()),
            },
        )
    return rows


def evaluate_feasibility_split(
    y_true: np.ndarray,
    y_pred: np.ndarray,
) -> dict[str, object]:
    base = regression_report(y_true, y_pred)
    base["calibration_buckets"] = bucket_calibration_summary(y_true, y_pred)
    return base
