"""Ranking metrics: NDCG@k, MRR, top-1, pairwise accuracy (caller supplies pairs)."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

import sys
from pathlib import Path

_ML = Path(__file__).resolve().parents[2]
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

from training.evaluation.metrics import accuracy, ndcg_at_k


def _group_col(df: pd.DataFrame) -> str:
    if "leakage_group_id" in df.columns:
        return "leakage_group_id"
    return "project_id"


def listwise_ranking_metrics(
    pointwise: pd.DataFrame,
    pred_scores: np.ndarray,
    y_relevance: np.ndarray,
    k: int = 5,
) -> dict[str, float]:
    """
    ``pointwise`` rows must match ``pred_scores`` and ``y_relevance`` length.
    Higher relevance = better (e.g. best_candidate).
    """
    if len(pointwise) != len(pred_scores) or len(pred_scores) != len(y_relevance):
        raise ValueError("length mismatch pointwise / scores / relevance")

    df = pointwise.reset_index(drop=True).copy()
    df["_s"] = pred_scores
    df["_r"] = y_relevance
    gc = _group_col(df)

    ndcgs: list[float] = []
    mrrs: list[float] = []
    top1: list[float] = []
    hits: list[float] = []

    for _, g in df.groupby(gc, sort=False):
        rel = g["_r"].astype(float).values
        sc = g["_s"].astype(float).values
        if len(g) < 2:
            continue
        kk = min(k, len(g))
        ndcgs.append(ndcg_at_k(rel.tolist(), sc.tolist(), kk))
        order = np.argsort(-sc)
        true_best_idx = int(np.argmax(rel))
        top_pred_idx = int(order[0])
        top1.append(float(true_best_idx == top_pred_idx))
        pos = np.where(order == true_best_idx)[0]
        mrrs.append(1.0 / (int(pos[0]) + 1) if len(pos) else 0.0)
        if "pointwise_binary_relevant" in g.columns and (g["pointwise_binary_relevant"].fillna(0) > 0).any():
            br = g["pointwise_binary_relevant"].fillna(0).values
            chosen = int(np.argmax(br))
            hits.append(float(top_pred_idx == chosen))
        elif rel.max() > rel.min():
            hits.append(float(top_pred_idx == true_best_idx))

    def _mean(xs: list[float]) -> float:
        return float(sum(xs) / len(xs)) if xs else 0.0

    return {
        f"ndcg_at_{min(k, 5)}": _mean(ndcgs),
        "mrr": _mean(mrrs),
        "top1_accuracy": _mean(top1),
        "hit_selected_proxy": _mean(hits) if hits else 0.0,
        "n_groups_eval": float(len(ndcgs)),
    }


def pairwise_accuracy(y_true: np.ndarray, y_score: np.ndarray, threshold: float = 0.5) -> float:
    pred = (y_score >= threshold).astype(np.int64)
    return accuracy(y_true, pred)
