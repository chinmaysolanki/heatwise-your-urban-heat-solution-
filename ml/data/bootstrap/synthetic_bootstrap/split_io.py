"""
Leakage-safe train/val/test assignment by ``project_id`` only.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from synthetic_bootstrap.config import GenerationConfig


def assign_project_splits(
    project_ids: list[str],
    gen_cfg: GenerationConfig,
    seed: int,
) -> pd.DataFrame:
    """Shuffle projects, assign exactly one split per project."""
    r = gen_cfg.train_ratio + gen_cfg.val_ratio + gen_cfg.test_ratio
    if abs(r - 1.0) > 1e-6:
        raise ValueError(f"split ratios must sum to 1.0, got {r}")

    rng = np.random.default_rng(seed)
    ids = np.array(sorted(set(project_ids)))
    rng.shuffle(ids)
    n = len(ids)
    n_train = int(n * gen_cfg.train_ratio)
    n_val = int(n * gen_cfg.val_ratio)
    n_test = n - n_train - n_val
    if n_test < 0:
        raise ValueError(
            f"split sizes overflow: n={n}, train={n_train}, val={n_val} (ratios too large)",
        )
    splits = ["train"] * n_train + ["val"] * n_val + ["test"] * n_test
    return pd.DataFrame({"project_id": ids, "split": splits})


def export_split_directories(
    ranking_df: pd.DataFrame,
    project_df: pd.DataFrame,
    manifest: pd.DataFrame,
    out_root: Path,
    labels_df: pd.DataFrame | None = None,
) -> dict[str, Path]:
    """
    Write ``train/``, ``val/``, ``test/`` subdirs each containing
    ``ranking_candidates.csv`` and ``project_features.csv`` filtered by manifest.
    """
    out_root.mkdir(parents=True, exist_ok=True)
    written: dict[str, Path] = {}
    for split in ("train", "val", "test"):
        pids = set(manifest.loc[manifest["split"] == split, "project_id"].astype(str))
        sub = out_root / split
        sub.mkdir(parents=True, exist_ok=True)
        r_sub = ranking_df[ranking_df["project_id"].isin(pids)].copy()
        p_sub = project_df[project_df["project_id"].isin(pids)].copy()
        rp = sub / "ranking_candidates.csv"
        pp = sub / "project_features.csv"
        r_sub.to_csv(rp, index=False)
        p_sub.to_csv(pp, index=False)
        written[f"{split}_ranking"] = rp
        written[f"{split}_projects"] = pp
        if labels_df is not None:
            lp = sub / "recommendation_labels.csv"
            labels_df[labels_df["project_id"].isin(pids)].to_csv(lp, index=False)
            written[f"{split}_labels"] = lp
    manifest_path = out_root / "split_manifest.csv"
    manifest.to_csv(manifest_path, index=False)
    written["manifest"] = manifest_path
    return written
