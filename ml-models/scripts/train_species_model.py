#!/usr/bin/env python3
"""
HeatWise — baseline multi-label species recommender training.

Loads a CSV from ml-models/data/, treats columns with a given prefix as binary
species labels, trains a MultiOutputClassifier(RandomForest), reports metrics,
and saves a sklearn Pipeline to ml-models/models/.

Not wired to Next.js or Prisma.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    hamming_loss,
    jaccard_score,
)
from sklearn.model_selection import train_test_split
from sklearn.multioutput import MultiOutputClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def _repo_ml_root() -> Path:
    """Directory containing data/, models/, scripts/."""
    return Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    root = _repo_ml_root()
    p = argparse.ArgumentParser(description="Train HeatWise multi-label species baseline.")
    p.add_argument(
        "--data",
        type=Path,
        default=root / "data" / "heatwise_species_sample.csv",
        help="Path to training CSV",
    )
    p.add_argument(
        "--target-prefix",
        type=str,
        default="species_",
        help="Prefix for multi-label target columns (binary 0/1)",
    )
    p.add_argument("--test-size", type=float, default=0.2, help="Holdout fraction")
    p.add_argument("--random-state", type=int, default=42)
    p.add_argument(
        "--output",
        type=Path,
        default=root / "models" / "species_model.joblib",
        help="Where to save the fitted pipeline",
    )
    p.add_argument(
        "--exclude-cols",
        type=str,
        default="",
        help="Comma-separated feature columns to drop (e.g. run_id,split)",
    )
    p.add_argument(
        "--n-estimators",
        type=int,
        default=100,
        help="RandomForest trees per label (MultiOutputClassifier)",
    )
    return p.parse_args()


def load_dataset(
    path: Path,
    target_prefix: str,
    exclude_cols: list[str],
) -> tuple[pd.DataFrame, pd.DataFrame, list[str], list[str]]:
    if not path.is_file():
        raise FileNotFoundError(f"Dataset not found: {path}")

    df = pd.read_csv(path)
    if df.empty:
        raise ValueError("Dataset is empty")

    target_cols = [c for c in df.columns if c.startswith(target_prefix)]
    if not target_cols:
        raise ValueError(
            f"No target columns with prefix {target_prefix!r}. "
            f"Columns present: {list(df.columns)}"
        )

    exclude_set = {x.strip() for x in exclude_cols if x.strip()}
    feature_cols = [
        c
        for c in df.columns
        if c not in target_cols and c not in exclude_set
    ]
    if not feature_cols:
        raise ValueError("No feature columns left after excluding targets and --exclude-cols")

    X = df[feature_cols]
    Y = df[target_cols].apply(pd.to_numeric, errors="coerce").fillna(0)
    # enforce binary {0,1}
    Y = Y.clip(0, 1).astype(int)

    return X, Y, feature_cols, target_cols


def build_preprocess_and_model(
    X: pd.DataFrame,
    n_estimators: int,
    random_state: int,
) -> Pipeline:
    numeric = X.select_dtypes(include=[np.number]).columns.tolist()
    categorical = [c for c in X.columns if c not in numeric]

    transformers = []
    if numeric:
        transformers.append(
            (
                "num",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                numeric,
            )
        )
    if categorical:
        transformers.append(
            (
                "cat",
                Pipeline(
                    steps=[
                        (
                            "imputer",
                            SimpleImputer(strategy="most_frequent"),
                        ),
                        (
                            "onehot",
                            OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                        ),
                    ]
                ),
                categorical,
            )
        )

    preprocess = ColumnTransformer(transformers=transformers, remainder="drop")

    clf = MultiOutputClassifier(
        RandomForestClassifier(
            n_estimators=n_estimators,
            random_state=random_state,
            n_jobs=-1,
            class_weight="balanced_subsample",
        )
    )

    return Pipeline(steps=[("preprocess", preprocess), ("clf", clf)])


def main() -> int:
    args = parse_args()
    exclude = [c for c in args.exclude_cols.split(",") if c.strip()]

    try:
        X, Y, feature_cols, target_cols = load_dataset(
            args.data, args.target_prefix, exclude
        )
    except (FileNotFoundError, ValueError) as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    X_train, X_test, Y_train, Y_test = train_test_split(
        X,
        Y,
        test_size=args.test_size,
        random_state=args.random_state,
    )

    pipeline = build_preprocess_and_model(
        X_train, args.n_estimators, args.random_state
    )
    print(f"Training on {len(X_train)} rows, {len(feature_cols)} feature columns, "
          f"{len(target_cols)} labels …")
    pipeline.fit(X_train, Y_train)

    Y_pred = pipeline.predict(X_test)

    hl = hamming_loss(Y_test, Y_pred)
    # subset accuracy: exact match of entire label vector
    subset_acc = accuracy_score(Y_test.values, Y_pred)
    jaccard_micro = jaccard_score(Y_test.values, Y_pred, average="micro", zero_division=0)
    jaccard_macro = jaccard_score(Y_test.values, Y_pred, average="macro", zero_division=0)
    f1_micro = f1_score(Y_test.values, Y_pred, average="micro", zero_division=0)
    f1_macro = f1_score(Y_test.values, Y_pred, average="macro", zero_division=0)

    print("\n=== Evaluation (test set) ===")
    print(f"Hamming loss (lower is better):     {hl:.4f}")
    print(f"Subset accuracy (exact multilabel): {subset_acc:.4f}")
    print(f"Jaccard (micro):                    {jaccard_micro:.4f}")
    print(f"Jaccard (macro):                    {jaccard_macro:.4f}")
    print(f"F1 (micro):                         {f1_micro:.4f}")
    print(f"F1 (macro):                         {f1_macro:.4f}")

    print("\n=== Per-label F1 (sample of labels with any positive in test) ===")
    shown = 0
    for i, col in enumerate(target_cols):
        yt = Y_test.iloc[:, i].values
        yp = Y_pred[:, i]
        if yt.sum() == 0 and yp.sum() == 0:
            continue
        f1_l = f1_score(yt, yp, zero_division=0)
        print(f"  {col}: F1={f1_l:.3f}  (support={int(yt.sum())})")
        shown += 1
        if shown >= 16:
            print("  … (more labels omitted)")
            break

    args.output.parent.mkdir(parents=True, exist_ok=True)
    artifact = {
        "pipeline": pipeline,
        "feature_columns": feature_cols,
        "target_columns": target_cols,
        "target_prefix": args.target_prefix,
    }
    joblib.dump(artifact, args.output)
    print(f"\nSaved artifact to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
