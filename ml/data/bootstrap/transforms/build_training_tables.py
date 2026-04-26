"""
Build processed training tables from raw normalized CSVs.

Outputs:
  - project_features.csv
  - recommendation_labels.csv
  - ranking_pairs.csv (copy / canonical reorder)
  - joined_training_table.csv (projects ⋈ candidates on project_id)
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from synthetic_bootstrap.table_schemas import LABEL_COLUMNS, RANKING_PAIR_COLUMNS


def build_training_tables(raw_dir: Path, processed_dir: Path) -> dict[str, Path]:
    raw_dir = Path(raw_dir)
    processed_dir = Path(processed_dir)
    processed_dir.mkdir(parents=True, exist_ok=True)

    projects = pd.read_csv(raw_dir / "projects.csv")
    candidates = pd.read_csv(raw_dir / "candidates.csv")
    pairs = pd.read_csv(raw_dir / "ranking_pairs.csv")

    out: dict[str, Path] = {}
    p_pf = processed_dir / "project_features.csv"
    projects.to_csv(p_pf, index=False)
    out["project_features"] = p_pf

    label_cols = [c for c in LABEL_COLUMNS if c in candidates.columns]
    p_lb = processed_dir / "recommendation_labels.csv"
    candidates[label_cols].to_csv(p_lb, index=False)
    out["recommendation_labels"] = p_lb

    pairs = pairs.reindex(columns=list(RANKING_PAIR_COLUMNS))
    p_rp = processed_dir / "ranking_pairs.csv"
    pairs.to_csv(p_rp, index=False)
    out["ranking_pairs"] = p_rp

    joined = candidates.merge(projects, on="project_id", how="left", suffixes=("", "_proj"))
    p_j = processed_dir / "joined_training_table.csv"
    joined.to_csv(p_j, index=False)
    out["joined_training_table"] = p_j

    p_c = processed_dir / "candidates.csv"
    candidates.to_csv(p_c, index=False)
    out["candidates"] = p_c
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Build processed training tables from raw CSVs.")
    ap.add_argument("--raw-dir", type=Path, required=True)
    ap.add_argument("--processed-dir", type=Path, required=True)
    args = ap.parse_args()
    paths = build_training_tables(args.raw_dir, args.processed_dir)
    for k, v in sorted(paths.items()):
        print(f"{k}: {v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
