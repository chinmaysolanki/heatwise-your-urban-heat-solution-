"""Build a single-row DataFrame for sklearn pipelines from snapshots + candidate dict."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pandas as pd

_ML = Path(__file__).resolve().parents[2]
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

from training.preprocess import add_species_primary_features


def merge_snapshots_to_row(
    project: dict[str, Any],
    environment: dict[str, Any],
    preferences: dict[str, Any],
    candidate: dict[str, Any],
) -> dict[str, Any]:
    row: dict[str, Any] = {}
    for part in (project, environment, preferences, candidate):
        for k, v in part.items():
            row[k] = v
    return row


def build_frame_for_bundle(
    row: dict[str, Any],
    feature_names: list[str],
    species_csv: Path | None,
) -> pd.DataFrame:
    """Columns missing in row become NaN; species join applied before column subset."""
    df = pd.DataFrame([row])
    df = add_species_primary_features(df, species_csv)
    cols = [c for c in feature_names if c in df.columns]
    missing = [c for c in feature_names if c not in df.columns]
    for c in missing:
        df[c] = float("nan")
    return df[feature_names].copy()
