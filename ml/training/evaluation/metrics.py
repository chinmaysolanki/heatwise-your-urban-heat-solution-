"""
Evaluation metrics for v1 tasks (numpy-only implementations where possible).
"""

from __future__ import annotations

import math
from typing import Sequence

import numpy as np


def mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true = np.asarray(y_true, dtype=np.float64).ravel()
    y_pred = np.asarray(y_pred, dtype=np.float64).ravel()
    return float(np.mean(np.abs(y_true - y_pred)))


def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true = np.asarray(y_true, dtype=np.float64).ravel()
    y_pred = np.asarray(y_pred, dtype=np.float64).ravel()
    return float(math.sqrt(np.mean((y_true - y_pred) ** 2)))


def r2_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true = np.asarray(y_true, dtype=np.float64).ravel()
    y_pred = np.asarray(y_pred, dtype=np.float64).ravel()
    ss_res = float(np.sum((y_true - y_pred) ** 2))
    ss_tot = float(np.sum((y_true - np.mean(y_true)) ** 2))
    if ss_tot < 1e-12:
        return 0.0
    return 1.0 - ss_res / ss_tot


def accuracy(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true = np.asarray(y_true).ravel()
    y_pred = np.asarray(y_pred).ravel()
    return float(np.mean(y_true == y_pred))


def roc_auc_binary(y_true: np.ndarray, y_score: np.ndarray) -> float:
    """Wilcoxon / Mann–Whitney AUC for binary labels; 0.5 if single class."""
    y_true = np.asarray(y_true, dtype=np.int64).ravel()
    y_score = np.asarray(y_score, dtype=np.float64).ravel()
    pos = y_score[y_true == 1]
    neg = y_score[y_true == 0]
    n_pos, n_neg = len(pos), len(neg)
    if n_pos == 0 or n_neg == 0:
        return 0.5
    gt = (pos.reshape(-1, 1) > neg.reshape(1, -1)).sum()
    eq = (pos.reshape(-1, 1) == neg.reshape(1, -1)).sum()
    return float((gt + 0.5 * eq) / (n_pos * n_neg))


def ndcg_at_k(
    y_true_relevance: Sequence[float],
    y_pred_scores: Sequence[float],
    k: int,
) -> float:
    """Single-query nDCG@k; relevance and scores aligned by candidate order."""
    rel = np.asarray(y_true_relevance, dtype=np.float64)
    scores = np.asarray(y_pred_scores, dtype=np.float64)
    order = np.argsort(-scores)[:k]
    dcg = sum((2 ** rel[i] - 1) / math.log2(j + 2) for j, i in enumerate(order))
    ideal_order = np.argsort(-rel)[:k]
    idcg = sum((2 ** rel[i] - 1) / math.log2(j + 2) for j, i in enumerate(ideal_order))
    if idcg < 1e-12:
        return 0.0
    return float(dcg / idcg)


def regression_report(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    return {
        "mae": mae(y_true, y_pred),
        "rmse": rmse(y_true, y_pred),
        "r2": r2_score(y_true, y_pred),
    }


def binary_report(y_true: np.ndarray, y_pred_labels: np.ndarray, y_score: np.ndarray | None = None) -> dict[str, float]:
    out: dict[str, float] = {"accuracy": accuracy(y_true, y_pred_labels)}
    if y_score is not None:
        out["roc_auc"] = roc_auc_binary(y_true, y_score)
    return out
