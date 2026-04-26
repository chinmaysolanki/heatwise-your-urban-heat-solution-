#!/usr/bin/env python3
"""
v1 baseline: pairwise preference (preferred vs other candidate).

Builds diff features: X_ij = |f(preferred) - f(other)| on the same feature registry as scorers.
Classifier: logistic regression on dense encoded diffs (simple linear baseline for RankNet-style pairs).

Requires: pandas, numpy, scikit-learn.
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
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from training.evaluation.metrics import binary_report, roc_auc_binary
from training.feature_registry import LABEL_LEAKAGE_COLUMNS, RANKING_V1_FEATURES
from training.preprocess import add_species_primary_features, infer_schema


def _load(path: Path) -> pd.DataFrame:
    return pd.read_csv(path)


def _features_for_candidates(
    joined: pd.DataFrame,
    species_csv: Path | None,
) -> pd.DataFrame:
    df = add_species_primary_features(joined, species_csv)
    cols = [c for c in RANKING_V1_FEATURES if c in df.columns]
    leak = [c for c in cols if c in LABEL_LEAKAGE_COLUMNS]
    if leak:
        raise ValueError(f"label leakage: {leak}")
    return df.set_index("candidate_id")[cols]


def _is_finite_num(v: object) -> bool:
    if isinstance(v, (bool, np.bool_)):
        return True
    if isinstance(v, (int, np.integer)):
        return True
    if isinstance(v, (float, np.floating)):
        return not np.isnan(v)
    return False


def _one_pair_row(fa: pd.Series, fb: pd.Series) -> dict[str, float | int]:
    """Numeric = |Δ|; categorical / bool = 1 if equal else 0 (v1 linear baseline)."""
    out: dict[str, float | int] = {}
    for c in fa.index:
        va, vb = fa[c], fb[c]
        if _is_finite_num(va) and _is_finite_num(vb):
            out[f"absdiff__{c}"] = float(abs(float(va) - float(vb)))
        else:
            if pd.isna(va) and pd.isna(vb):
                m = 1
            elif pd.isna(va) or pd.isna(vb):
                m = 0
            else:
                m = int(str(va) == str(vb))
            out[f"match__{c}"] = m
    return out


def _pair_frame(
    pairs: pd.DataFrame,
    feat_by_cand: pd.DataFrame,
) -> tuple[pd.DataFrame, np.ndarray]:
    rows: list[dict[str, float | int]] = []
    y: list[int] = []
    for _, r in pairs.iterrows():
        a = str(r["preferred_candidate_id"])
        b = str(r["other_candidate_id"])
        if a not in feat_by_cand.index or b not in feat_by_cand.index:
            continue
        fa = feat_by_cand.loc[a]
        fb = feat_by_cand.loc[b]
        rows.append(_one_pair_row(fa, fb))
        y.append(int(r["preference_label"]))
    X = pd.DataFrame(rows)
    return X, np.array(y, dtype=np.int64)


def _make_pipeline(schema) -> Pipeline:
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
        raise ValueError("No numeric or categorical columns after schema inference")
    pre = ColumnTransformer(transformers=parts, remainder="drop")
    return Pipeline(
        steps=[
            ("pre", pre),
            ("model", LogisticRegression(max_iter=500, random_state=44)),
        ],
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Pairwise ranking baseline (logistic on |Δf|).")
    ap.add_argument("--train-joined-csv", type=Path, required=True)
    ap.add_argument("--train-pairs-csv", type=Path, required=True)
    ap.add_argument("--val-joined-csv", type=Path, required=True)
    ap.add_argument("--val-pairs-csv", type=Path, required=True)
    ap.add_argument("--test-joined-csv", type=Path, required=True)
    ap.add_argument("--test-pairs-csv", type=Path, required=True)
    ap.add_argument("--species-csv", type=Path, default=None)
    ap.add_argument("--out-dir", type=Path, default=Path("runs/ranking_baseline"))
    args = ap.parse_args()

    def go(joined_path: Path, pairs_path: Path):
        joined = _load(joined_path)
        pairs = _load(pairs_path)
        feat = _features_for_candidates(joined, args.species_csv)
        X, y = _pair_frame(pairs, feat)
        schema = infer_schema(X, list(X.columns))
        return X, y, schema

    X_tr, y_tr, schema_tr = go(args.train_joined_csv, args.train_pairs_csv)
    X_va, y_va, _ = go(args.val_joined_csv, args.val_pairs_csv)
    X_te, y_te, _ = go(args.test_joined_csv, args.test_pairs_csv)

    pipe = _make_pipeline(schema_tr)
    pipe.fit(X_tr, y_tr)

    def eval_split(X, y, name: str) -> dict:
        proba = pipe.predict_proba(X)[:, 1]
        pred = (proba >= 0.5).astype(np.int64)
        br = binary_report(y, pred, proba)
        br["pair_auc"] = roc_auc_binary(y, proba)
        return br

    report = {
        "task": "ranking_pairwise",
        "train": eval_split(X_tr, y_tr, "train"),
        "val": eval_split(X_va, y_va, "val"),
        "test": eval_split(X_te, y_te, "test"),
        "n_pairs_train": int(len(y_tr)),
    }
    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / "metrics.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
