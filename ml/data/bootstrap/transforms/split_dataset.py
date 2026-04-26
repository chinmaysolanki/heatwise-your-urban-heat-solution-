"""
Leakage-safe train/val/test split by project_id.

Reads processed tables and writes ``outputs/processed/splits/{train,val,test}/``.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from synthetic_bootstrap.table_schemas import LABEL_COLUMNS


def assign_splits(
    project_ids: list[str],
    train_ratio: float,
    val_ratio: float,
    test_ratio: float,
    seed: int,
) -> pd.DataFrame:
    r = train_ratio + val_ratio + test_ratio
    if abs(r - 1.0) > 1e-6:
        raise ValueError(f"split ratios must sum to 1.0, got {r}")
    rng = np.random.default_rng(seed)
    ids = np.array(sorted(set(project_ids)))
    rng.shuffle(ids)
    n = len(ids)
    n_train = int(n * train_ratio)
    n_val = int(n * val_ratio)
    n_test = n - n_train - n_val
    if n_test < 0:
        raise ValueError("split ratio allocation invalid for n projects")
    splits = ["train"] * n_train + ["val"] * n_val + ["test"] * n_test
    return pd.DataFrame({"project_id": ids, "split": splits})


def split_dataset(
    processed_dir: Path,
    *,
    train_ratio: float = 0.7,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42,
) -> dict[str, Any]:
    processed_dir = Path(processed_dir)
    joined = pd.read_csv(processed_dir / "joined_training_table.csv")
    projects = pd.read_csv(processed_dir / "project_features.csv")
    pairs = pd.read_csv(processed_dir / "ranking_pairs.csv")

    cand_path = processed_dir / "candidates.csv"
    if not cand_path.is_file():
        cand_path = processed_dir.parent / "raw" / "candidates.csv"
    if not cand_path.is_file():
        raise FileNotFoundError("candidates.csv not found under processed/ or raw/")
    candidates_full = pd.read_csv(cand_path)

    pids = joined["project_id"].astype(str).unique().tolist()
    manifest = assign_splits(pids, train_ratio, val_ratio, test_ratio, seed)
    root = processed_dir / "splits"
    root.mkdir(parents=True, exist_ok=True)
    manifest.to_csv(root / "split_manifest.csv", index=False)

    written: dict[str, Path] = {}
    summary: dict[str, Any] = {}

    for split in ("train", "val", "test"):
        p_set = set(manifest.loc[manifest["split"] == split, "project_id"].astype(str))
        sub = root / split
        sub.mkdir(parents=True, exist_ok=True)

        j_sub = joined[joined["project_id"].astype(str).isin(p_set)]
        pr_sub = projects[projects["project_id"].astype(str).isin(p_set)]
        ca_sub = candidates_full[candidates_full["project_id"].astype(str).isin(p_set)]
        c_ids = set(ca_sub["candidate_id"].astype(str))
        pa_sub = pairs[pairs["project_id"].astype(str).isin(p_set)]
        pa_sub = pa_sub[
            pa_sub["preferred_candidate_id"].astype(str).isin(c_ids)
            & pa_sub["other_candidate_id"].astype(str).isin(c_ids)
        ]

        j_sub.to_csv(sub / "joined_training_table.csv", index=False)
        pr_sub.to_csv(sub / "projects.csv", index=False)
        ca_sub.to_csv(sub / "candidates.csv", index=False)
        pa_sub.to_csv(sub / "ranking_pairs.csv", index=False)

        lb_cols = [c for c in LABEL_COLUMNS if c in ca_sub.columns]
        ca_sub[lb_cols].to_csv(sub / "recommendation_labels.csv", index=False)

        written[split] = sub
        summary[split] = {
            "n_projects": len(p_set),
            "n_candidates": len(ca_sub),
            "n_joined_rows": len(j_sub),
            "n_pairs": len(pa_sub),
        }

    summary_path = root / "split_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    written["manifest"] = root / "split_manifest.csv"
    written["summary"] = summary_path
    return {"paths": written, "summary": summary}


def main() -> int:
    ap = argparse.ArgumentParser(description="Split processed dataset by project_id.")
    ap.add_argument("--processed-dir", type=Path, required=True)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--train-ratio", type=float, default=0.7)
    ap.add_argument("--val-ratio", type=float, default=0.15)
    ap.add_argument("--test-ratio", type=float, default=0.15)
    args = ap.parse_args()
    out = split_dataset(
        args.processed_dir,
        train_ratio=args.train_ratio,
        val_ratio=args.val_ratio,
        test_ratio=args.test_ratio,
        seed=args.seed,
    )
    print(json.dumps(out["summary"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
