"""
Preprocessing scaffolding: fit on train only, apply consistently to val/test.

v1 stack: pandas + numpy; optional scikit-learn in baseline scripts for encoders.
This module stays dependency-light: it documents contracts and offers small helpers.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from training.feature_registry import SPECIES_DERIVED_CATEGORICAL, SPECIES_DERIVED_NUMERIC


@dataclass
class ColumnSchema:
    """Which columns are treated as numeric vs categorical for v1."""

    numeric: list[str]
    categorical: list[str]


def infer_schema(frame: pd.DataFrame, feature_cols: list[str]) -> ColumnSchema:
    """Infer numeric vs object columns from dtypes (bootstrap uses int/float for flags)."""
    numeric: list[str] = []
    categorical: list[str] = []
    for c in feature_cols:
        if c not in frame.columns:
            continue
        if pd.api.types.is_numeric_dtype(frame[c]):
            numeric.append(c)
        else:
            categorical.append(c)
    return ColumnSchema(numeric=numeric, categorical=categorical)


def add_species_primary_features(
    joined: pd.DataFrame,
    species_csv: Path | None,
) -> pd.DataFrame:
    """
    Left-join species library on ``species_primary`` == ``species_name``.

    Adds derived columns listed in ``feature_registry.SPECIES_DERIVED_*``.
    """
    out = joined.copy()
    if species_csv is None or not Path(species_csv).is_file():
        for c in (*SPECIES_DERIVED_NUMERIC, *SPECIES_DERIVED_CATEGORICAL):
            out[c] = np.nan
        return out

    sp = pd.read_csv(species_csv)
    if "species_name" not in sp.columns:
        raise ValueError("species_features.csv must contain species_name")
    water_map = {"LOW": 0, "MED": 1, "HIGH": 2}
    sub = sp.set_index("species_name")
    primary = out["species_primary"].astype(str)

    def g(col: str, default: Any = np.nan) -> pd.Series:
        return primary.map(lambda x: sub[col].get(x, default) if x in sub.index else default)

    out["species_primary_cooling_contribution"] = g("cooling_contribution", 0)
    wd = g("water_demand", "MED")
    out["species_primary_water_demand_ord"] = wd.map(lambda x: water_map.get(str(x), 1))
    out["species_primary_pollinator_value"] = g("pollinator_value", 0)
    out["species_primary_edible_flag"] = g("edible_flag", 0)
    out["species_primary_privacy_contribution"] = g("privacy_contribution", 0)
    out["species_primary_container_suitability"] = g("container_suitability", "UNKNOWN")
    out["species_primary_growth_habit"] = g("growth_habit", "UNKNOWN")
    return out


@dataclass
class SimpleTrainStats:
    """Train-only statistics for numeric median impute + categorical mode impute."""

    numeric_medians: dict[str, float] = field(default_factory=dict)
    categorical_modes: dict[str, str] = field(default_factory=dict)


def fit_simple_impute(train: pd.DataFrame, schema: ColumnSchema) -> SimpleTrainStats:
    stats = SimpleTrainStats()
    for c in schema.numeric:
        stats.numeric_medians[c] = float(train[c].median())
    for c in schema.categorical:
        mode = train[c].mode(dropna=True)
        stats.categorical_modes[c] = str(mode.iloc[0]) if len(mode) else "missing"
    return stats


def apply_simple_impute(df: pd.DataFrame, schema: ColumnSchema, stats: SimpleTrainStats) -> pd.DataFrame:
    out = df.copy()
    for c in schema.numeric:
        out[c] = out[c].fillna(stats.numeric_medians.get(c, 0.0))
    for c in schema.categorical:
        out[c] = out[c].fillna(stats.categorical_modes.get(c, "missing")).astype(str)
    return out


# ---------------------------------------------------------------------------
# Production contract (implement with sklearn in baseline scripts):
# 1. Fit OneHotEncoder(handle_unknown="ignore") on train categoricals only.
# 2. Fit StandardScaler on train numerics only (after impute).
# 3. Serialize fitted encoders + scaler + column order to disk for serving.
# 4. Never refit on val/test; never peek at test when choosing categories.
# ---------------------------------------------------------------------------
