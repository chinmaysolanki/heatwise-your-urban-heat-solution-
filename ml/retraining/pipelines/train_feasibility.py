"""Train feasibility regressor (sklearn HGBR pipeline)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

import sys

_ML = Path(__file__).resolve().parents[2]
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

from training.evaluation.metrics import regression_report
from training.preprocess import infer_schema


def _regression_pipeline(schema: Any, hyperparams: dict[str, Any] | None) -> Pipeline:
    hp = hyperparams or {}
    num_pipe = Pipeline(steps=[("impute", SimpleImputer(strategy="median"))])
    cat_pipe = Pipeline(
        steps=[
            ("impute", SimpleImputer(strategy="constant", fill_value="missing")),
            ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False, max_categories=50)),
        ],
    )
    parts: list[tuple[str, Pipeline, list[str]]] = []
    if schema.numeric:
        parts.append(("num", num_pipe, schema.numeric))
    if schema.categorical:
        parts.append(("cat", cat_pipe, schema.categorical))
    if not parts:
        raise ValueError("no features after schema inference")
    pre = ColumnTransformer(transformers=parts, remainder="drop")
    est = HistGradientBoostingRegressor(
        max_depth=int(hp.get("max_depth", 6)),
        learning_rate=float(hp.get("learning_rate", 0.08)),
        max_iter=int(hp.get("max_iter", 200)),
        random_state=int(hp.get("random_state", 42)),
    )
    return Pipeline(steps=[("pre", pre), ("model", est)])


def train_feasibility(
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
        "task": "feasibility",
        "train": _pred(X_train, y_train),
        "val": _pred(X_val, y_val),
        "test": _pred(X_test, y_test),
        "n_features_raw": len(cols),
    }
    return pipe, metrics
