"""
Load hybrid dataset snapshot (CSV bundle from ``ml/hybrid_data``).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd


@dataclass
class HybridSnapshot:
    """Immutable view of one training snapshot directory."""

    snapshot_id: str
    root: Path
    pointwise: pd.DataFrame
    pairs: pd.DataFrame
    outcomes: pd.DataFrame
    manifest: dict[str, Any] = field(default_factory=dict)


def load_hybrid_snapshot(
    dataset_path: Path,
    train_snapshot_id: str | None = None,
) -> HybridSnapshot:
    """
    Load ``hybrid_pointwise.csv``, optional ``hybrid_ranking_pairs.csv``,
    ``hybrid_outcome_rows.csv``, and ``hybrid_manifest.json``.
    """
    root = Path(dataset_path).resolve()
    if not root.is_dir():
        raise FileNotFoundError(f"dataset path not a directory: {root}")

    pw_path = root / "hybrid_pointwise.csv"
    if not pw_path.is_file():
        raise FileNotFoundError(f"missing hybrid_pointwise.csv under {root}")

    pointwise = pd.read_csv(pw_path)
    pairs_path = root / "hybrid_ranking_pairs.csv"
    pairs = pd.read_csv(pairs_path) if pairs_path.is_file() else pd.DataFrame()
    out_path = root / "hybrid_outcome_rows.csv"
    outcomes = pd.read_csv(out_path) if out_path.is_file() else pd.DataFrame()

    man_path = root / "hybrid_manifest.json"
    manifest: dict[str, Any] = {}
    if man_path.is_file():
        manifest = json.loads(man_path.read_text(encoding="utf-8"))

    snap_id = train_snapshot_id or manifest.get("snapshot_id") or root.name
    return HybridSnapshot(
        snapshot_id=str(snap_id),
        root=root,
        pointwise=pointwise,
        pairs=pairs,
        outcomes=outcomes,
        manifest=manifest,
    )


def snapshot_source_mix(pointwise: pd.DataFrame) -> dict[str, Any]:
    """Counts for logging / registry."""
    if pointwise.empty:
        return {}
    out: dict[str, Any] = {}
    if "data_source" in pointwise.columns:
        out["by_data_source"] = pointwise["data_source"].value_counts().to_dict()
    if "label_confidence_tier" in pointwise.columns:
        out["by_tier"] = pointwise["label_confidence_tier"].value_counts().to_dict()
    out["n_rows"] = len(pointwise)
    return out
