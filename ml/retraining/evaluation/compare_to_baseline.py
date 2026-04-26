"""Compare current metrics JSON to a baseline metrics JSON."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_metrics(path: Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _get_nested(d: dict[str, Any], *keys: str) -> float | None:
    cur: Any = d
    for k in keys:
        if not isinstance(cur, dict) or k not in cur:
            return None
        cur = cur[k]
    return float(cur) if cur is not None else None


def compare_regression(
    candidate: dict[str, Any],
    baseline: dict[str, Any],
    split: str = "val",
) -> dict[str, Any]:
    out: dict[str, Any] = {"split": split}
    for m in ("mae", "rmse", "r2"):
        c = _get_nested(candidate, split, m)
        b = _get_nested(baseline, split, m)
        if c is None or b is None:
            continue
        out[f"{m}_candidate"] = c
        out[f"{m}_baseline"] = b
        out[f"{m}_delta"] = c - b if m != "r2" else c - b  # lower MAE/RMSE better; higher R2 better
    return out


def compare_ranking_listwise(
    candidate: dict[str, Any],
    baseline: dict[str, Any],
    split: str = "val",
) -> dict[str, Any]:
    c = candidate.get("listwise", {}).get(split, {})
    b = baseline.get("listwise", {}).get(split, {})
    out: dict[str, Any] = {}
    for k in ("ndcg_at_5", "mrr", "top1_accuracy"):
        if k in c and k in b:
            out[f"{k}_delta"] = float(c[k]) - float(b[k])
            out[f"{k}_candidate"] = float(c[k])
            out[f"{k}_baseline"] = float(b[k])
    return out


def summarize_comparison(
    task: str,
    candidate_metrics: dict[str, Any],
    baseline_metrics: dict[str, Any] | None,
) -> dict[str, Any]:
    if baseline_metrics is None:
        return {"task": task, "baseline": "none"}
    if task in ("feasibility", "heat_score"):
        return {
            "task": task,
            "regression_val": compare_regression(candidate_metrics, baseline_metrics, "val"),
            "regression_test": compare_regression(candidate_metrics, baseline_metrics, "test"),
        }
    if task == "ranking":
        return {
            "task": task,
            "listwise_val": compare_ranking_listwise(candidate_metrics, baseline_metrics, "val"),
            "listwise_test": compare_ranking_listwise(candidate_metrics, baseline_metrics, "test"),
        }
    raise ValueError(task)
