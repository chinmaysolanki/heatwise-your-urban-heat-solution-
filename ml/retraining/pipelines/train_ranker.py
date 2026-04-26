"""
Ranking: pairwise logistic when enough pairs; listwise HGBR on binary relevance for NDCG/top-1.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

import sys

_ML = Path(__file__).resolve().parents[2]
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

from retraining.pipelines.ranking_features import features_for_candidates, pair_frame_from_features
from retraining.pipelines.train_feasibility import _regression_pipeline
from training.evaluation.metrics import binary_report, roc_auc_binary
from training.preprocess import infer_schema


def _pair_pipeline(schema: Any) -> Pipeline:
    num_pipe = Pipeline(steps=[("impute", SimpleImputer(strategy="constant", fill_value=0.0))])
    cat_pipe = Pipeline(
        steps=[
            ("impute", SimpleImputer(strategy="constant", fill_value="missing")),
            ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False, max_categories=40)),
        ],
    )
    parts: list[tuple[str, Pipeline, list[str]]] = []
    if schema.numeric:
        parts.append(("num", num_pipe, schema.numeric))
    if schema.categorical:
        parts.append(("cat", cat_pipe, schema.categorical))
    if not parts:
        raise ValueError("no pair features")
    pre = ColumnTransformer(transformers=parts, remainder="drop")
    return Pipeline(
        steps=[("pre", pre), ("model", LogisticRegression(max_iter=500, random_state=44))],
    )


def train_ranker(
    train_pointwise: pd.DataFrame,
    val_pointwise: pd.DataFrame,
    test_pointwise: pd.DataFrame,
    train_pairs: pd.DataFrame,
    val_pairs: pd.DataFrame,
    test_pairs: pd.DataFrame,
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    X_val: pd.DataFrame,
    y_val: np.ndarray,
    X_test: pd.DataFrame,
    y_test: np.ndarray,
    species_csv: Path | None,
    *,
    sample_weight: np.ndarray | None = None,
    hyperparams: dict[str, Any] | None = None,
    min_pairs: int = 8,
) -> tuple[dict[str, Any], Pipeline | None, Pipeline]:
    """
    Returns (metrics_dict, pairwise_pipe_or_none, listwise_pipe).
    """
    metrics: dict[str, Any] = {"task": "ranking"}

    listwise_schema = infer_schema(X_train, list(X_train.columns))
    listwise_pipe = _regression_pipeline(listwise_schema, hyperparams)
    fit_kw: dict[str, Any] = {}
    if sample_weight is not None:
        fit_kw["model__sample_weight"] = sample_weight
    listwise_pipe.fit(X_train, y_train, **fit_kw)

    def _listwise_pred(X: pd.DataFrame, y: np.ndarray, pw: pd.DataFrame) -> dict[str, Any]:
        from retraining.evaluation.evaluate_ranker import listwise_ranking_metrics

        scores = listwise_pipe.predict(X)
        return listwise_ranking_metrics(pw, scores, y)

    metrics["listwise"] = {
        "train": _listwise_pred(X_train, y_train, train_pointwise),
        "val": _listwise_pred(X_val, y_val, val_pointwise),
        "test": _listwise_pred(X_test, y_test, test_pointwise),
    }

    pair_pipe: Pipeline | None = None
    if len(train_pairs) >= min_pairs:
        try:
            ft_tr = features_for_candidates(train_pointwise, species_csv)
            Xp_tr, yp_tr = pair_frame_from_features(train_pairs, ft_tr)
            if len(yp_tr) >= min_pairs:
                ft_va = features_for_candidates(val_pointwise, species_csv)
                Xp_va, yp_va = pair_frame_from_features(val_pairs, ft_va)
                ft_te = features_for_candidates(test_pointwise, species_csv)
                Xp_te, yp_te = pair_frame_from_features(test_pairs, ft_te)
                schema_p = infer_schema(Xp_tr, list(Xp_tr.columns))
                pair_pipe = _pair_pipeline(schema_p)
                pair_pipe.fit(Xp_tr, yp_tr)

                def _pev(X: pd.DataFrame, y: np.ndarray) -> dict[str, float]:
                    proba = pair_pipe.predict_proba(X)[:, 1]
                    pred = (proba >= 0.5).astype(np.int64)
                    br = binary_report(y, pred, proba)
                    br["pair_auc"] = roc_auc_binary(y, proba)
                    return br

                metrics["pairwise"] = {
                    "train": _pev(Xp_tr, yp_tr),
                    "val": _pev(Xp_va, yp_va) if len(yp_va) else {},
                    "test": _pev(Xp_te, yp_te) if len(yp_te) else {},
                    "n_pairs_train": int(len(yp_tr)),
                }
        except Exception as ex:  # noqa: BLE001
            metrics["pairwise_error"] = str(ex)

    return metrics, pair_pipe, listwise_pipe
