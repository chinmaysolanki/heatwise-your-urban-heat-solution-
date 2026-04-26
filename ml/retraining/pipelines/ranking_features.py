"""Pairwise diff features (aligned with ``training/baselines/train_ranking_baseline``)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

import sys

_ML = Path(__file__).resolve().parents[2]
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

from training.feature_registry import LABEL_LEAKAGE_COLUMNS, RANKING_V1_FEATURES
from training.preprocess import add_species_primary_features


def _is_finite_num(v: object) -> bool:
    if isinstance(v, (bool, np.bool_)):
        return True
    if isinstance(v, (int, np.integer)):
        return True
    if isinstance(v, (float, np.floating)):
        return not np.isnan(v)
    return False


def _one_pair_row(fa: pd.Series, fb: pd.Series) -> dict[str, float | int]:
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


def features_for_candidates(joined: pd.DataFrame, species_csv: Path | None) -> pd.DataFrame:
    df = add_species_primary_features(joined, species_csv)
    id_col = "candidate_id" if "candidate_id" in df.columns else "candidate_key"
    cols = [c for c in RANKING_V1_FEATURES if c in df.columns]
    leak = [c for c in cols if c in LABEL_LEAKAGE_COLUMNS]
    if leak:
        raise ValueError(f"label leakage: {leak}")
    return df.set_index(df[id_col].astype(str))[cols]


def pair_frame_from_features(
    pairs: pd.DataFrame,
    feat_by_cand: pd.DataFrame,
) -> tuple[pd.DataFrame, np.ndarray]:
    rows: list[dict[str, float | int]] = []
    y: list[int] = []
    for _, r in pairs.iterrows():
        a, b = str(r["preferred_candidate_id"]), str(r["other_candidate_id"])
        if a not in feat_by_cand.index or b not in feat_by_cand.index:
            continue
        fa = feat_by_cand.loc[a]
        fb = feat_by_cand.loc[b]
        rows.append(_one_pair_row(fa, fb))
        y.append(int(r["preference_label"]))
    if not rows:
        return pd.DataFrame(), np.array([], dtype=np.int64)
    return pd.DataFrame(rows), np.array(y, dtype=np.int64)
