#!/usr/bin/env python3
"""
v1 baseline: regress ``feasibility_score`` from project + solution + species-derived features.

Requires: pandas, numpy, scikit-learn.
Input: ``joined_training_table.csv`` per split (from bootstrap ``outputs/processed/splits/*``).

This script is scaffolding: default hyperparameters, no tuning — swap estimator in Phase 2.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML.parent))

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from training.evaluation.metrics import regression_report
from training.feature_registry import FEASIBILITY_V1_FEATURES, LABEL_LEAKAGE_COLUMNS
from training.preprocess import add_species_primary_features, infer_schema
from training.target_registry import FEASIBILITY_TARGET


def _load(path: Path) -> pd.DataFrame:
    return pd.read_csv(path)


def _build_xy(df: pd.DataFrame, species_csv: Path | None):
    df = add_species_primary_features(df, species_csv)
    cols = [c for c in FEASIBILITY_V1_FEATURES if c in df.columns]
    leak = [c for c in cols if c in LABEL_LEAKAGE_COLUMNS]
    if leak:
        raise ValueError(f"label leakage into X: {leak}")
    X = df[cols].copy()
    y = df[FEASIBILITY_TARGET.column].astype(np.float32).values
    schema = infer_schema(X, cols)
    return X, y, schema


def _make_pipeline(schema) -> Pipeline:
    num_pipe = Pipeline(
        steps=[("impute", SimpleImputer(strategy="median"))],
    )
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
        raise ValueError("No numeric or categorical columns after schema inference")
    pre = ColumnTransformer(transformers=parts, remainder="drop")
    return Pipeline(
        steps=[
            ("pre", pre),
            (
                "model",
                HistGradientBoostingRegressor(
                    max_depth=6,
                    learning_rate=0.08,
                    max_iter=200,
                    random_state=42,
                ),
            ),
        ],
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Feasibility score baseline (HGBR).")
    ap.add_argument("--train-csv", type=Path, required=True)
    ap.add_argument("--val-csv", type=Path, required=True)
    ap.add_argument("--test-csv", type=Path, required=True)
    ap.add_argument("--species-csv", type=Path, default=None)
    ap.add_argument("--out-dir", type=Path, default=Path("runs/feasibility_baseline"))
    args = ap.parse_args()

    X_tr, y_tr, schema_tr = _build_xy(_load(args.train_csv), args.species_csv)
    X_va, y_va, _ = _build_xy(_load(args.val_csv), args.species_csv)
    X_te, y_te, _ = _build_xy(_load(args.test_csv), args.species_csv)

    pipe = _make_pipeline(schema_tr)
    pipe.fit(X_tr, y_tr)

    pred_tr = pipe.predict(X_tr)
    pred_va = pipe.predict(X_va)
    pred_te = pipe.predict(X_te)

    report = {
        "task": "feasibility",
        "target": FEASIBILITY_TARGET.column,
        "train": regression_report(y_tr, pred_tr),
        "val": regression_report(y_va, pred_va),
        "test": regression_report(y_te, pred_te),
        "n_features_raw": len(FEASIBILITY_V1_FEATURES),
    }
    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / "metrics.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
