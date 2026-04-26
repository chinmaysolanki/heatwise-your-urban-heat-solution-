"""Train heat mitigation / relevance regressor (same estimator as feasibility)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline

import sys

_ML = Path(__file__).resolve().parents[2]
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

from retraining.pipelines.train_feasibility import _regression_pipeline
from training.evaluation.metrics import regression_report
from training.preprocess import infer_schema


def train_heat_score(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    X_val: pd.DataFrame,
    y_val: np.ndarray,
    X_test: pd.DataFrame,
    y_test: np.ndarray,
    *,
    sample_weight: np.ndarray | None = None,
    hyperparams: dict[str, Any] | None = None,
) -> tuple[Pipeline, dict[str, Any]]:
    cols = list(X_train.columns)
    schema = infer_schema(X_train, cols)
    pipe = _regression_pipeline(schema, hyperparams)
    fit_kw: dict[str, Any] = {}
    if sample_weight is not None:
        fit_kw["model__sample_weight"] = sample_weight
    pipe.fit(X_train, y_train, **fit_kw)

    def _pred(X: pd.DataFrame, y: np.ndarray) -> dict[str, float]:
        p = pipe.predict(X)
        return regression_report(y, p)

    metrics = {
        "task": "heat_score",
        "train": _pred(X_train, y_train),
        "val": _pred(X_val, y_val),
        "test": _pred(X_test, y_test),
        "n_features_raw": len(cols),
    }
    return pipe, metrics
