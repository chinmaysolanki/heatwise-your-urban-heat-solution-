"""
Derive training tables: species features, project features, recommendation labels.
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from synthetic_bootstrap.registries import CANDIDATE_SOLUTION_COLUMNS, PROJECT_FEATURE_COLUMNS
from synthetic_bootstrap.species import get_species_library
from synthetic_bootstrap.table_schemas import LABEL_COLUMNS


def species_training_features_dataframe() -> pd.DataFrame:
    """Flat species table for training exports (schema per data dictionary)."""
    rows: list[dict[str, Any]] = []
    for sp in get_species_library():
        rows.append(
            {
                "species_name": sp.species_name,
                "climate_suitability": "|".join(sp.climate_suitability),
                "sunlight_preference": sp.sunlight_preference,
                "water_demand": sp.water_demand,
                "maintenance_need": sp.maintenance_need,
                "root_aggressiveness": sp.root_aggressiveness,
                "pollinator_value": sp.pollinator_value,
                "edible_flag": int(sp.edible),
                "child_pet_safe": sp.child_pet_safety,
                "native_support": sp.native_support,
                "container_suitability": sp.container_suitability,
                "cooling_contribution": sp.cooling_contribution,
                "privacy_contribution": sp.privacy_contribution,
                "growth_habit": sp.growth_habit,
            },
        )
    return pd.DataFrame(rows)


def species_library_dataframe() -> pd.DataFrame:
    """Backward-compatible alias including ``species_key`` for debugging joins."""
    rows: list[dict[str, Any]] = []
    for sp in get_species_library():
        rows.append(
            {
                "species_key": sp.key,
                "species_name": sp.species_name,
                "climate_suitability": "|".join(sp.climate_suitability),
                "sunlight_preference": sp.sunlight_preference,
                "water_demand": sp.water_demand,
                "maintenance_need": sp.maintenance_need,
                "root_aggressiveness": sp.root_aggressiveness,
                "pollinator_value": sp.pollinator_value,
                "edible": int(sp.edible),
                "child_pet_safety": sp.child_pet_safety,
                "native_support": sp.native_support,
                "container_suitability": sp.container_suitability,
                "cooling_contribution": sp.cooling_contribution,
                "privacy_contribution": sp.privacy_contribution,
                "growth_habit": sp.growth_habit,
            },
        )
    return pd.DataFrame(rows)


def ranking_export_column_order() -> list[str]:
    """Stable column order for long-form ranking CSV (internal / QA)."""
    base_inputs = [c for c in PROJECT_FEATURE_COLUMNS if c != "project_id"]
    return [
        "project_id",
        "candidate_id",
        "rank_position",
        "best_candidate",
        *base_inputs,
        *CANDIDATE_SOLUTION_COLUMNS,
    ]


def build_project_features_df(ranking_df: pd.DataFrame) -> pd.DataFrame:
    """One row per ``project_id`` (deduped from ranking table)."""
    cols = list(PROJECT_FEATURE_COLUMNS)
    missing = [c for c in cols if c not in ranking_df.columns]
    if missing:
        raise ValueError(f"ranking_df missing project feature columns: {missing}")
    out = ranking_df[cols].drop_duplicates(subset=["project_id"], keep="first")
    return out.reset_index(drop=True)


def build_recommendation_labels_df(ranking_df: pd.DataFrame) -> pd.DataFrame:
    """Narrow label table for multitask / LTR training."""
    use = [c for c in LABEL_COLUMNS if c in ranking_df.columns]
    return ranking_df[use].copy()
