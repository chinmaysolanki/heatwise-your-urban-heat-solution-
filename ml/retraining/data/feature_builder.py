"""
Build feature matrices and a JSON-serializable feature manifest (audit / serving).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

# Import training registry (ml on path)
import sys

_ML = Path(__file__).resolve().parents[2]
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

from training.feature_registry import (
    FEASIBILITY_V1_FEATURES,
    HEAT_MITIGATION_V1_FEATURES,
    LABEL_LEAKAGE_COLUMNS,
    RANKING_V1_FEATURES,
)
from training.preprocess import add_species_primary_features, infer_schema


@dataclass
class FeatureEntry:
    name: str
    group: str
    dtype: str
    encoding: str
    missing_policy: str
    normalization: str
    source_columns: list[str] = field(default_factory=list)


@dataclass
class FeatureManifest:
    task: str
    feature_names: list[str]
    feature_groups: dict[str, list[str]]
    entries: list[FeatureEntry]
    dropped_columns: list[str]
    target_column: str
    species_csv_used: str | None
    row_counts: dict[str, int] = field(default_factory=dict)

    def to_json_dict(self) -> dict[str, Any]:
        return {
            "task": self.task,
            "feature_names": self.feature_names,
            "feature_groups": self.feature_groups,
            "entries": [asdict(e) for e in self.entries],
            "dropped_columns": self.dropped_columns,
            "target_column": self.target_column,
            "species_csv_used": self.species_csv_used,
            "row_counts": self.row_counts,
        }

    def write(self, path: Path) -> None:
        path.write_text(json.dumps(self.to_json_dict(), indent=2), encoding="utf-8")


def _group_for_feature(col: str) -> str:
    if col.startswith("species_primary_"):
        return "species_derived"
    if col in (
        "budget_inr",
        "maintenance_preference",
        "aesthetic_style",
        "purpose_primary",
        "child_pet_safe_required",
        "edible_plants_preferred",
        "flowering_preferred",
        "privacy_required",
        "seating_required",
        "shade_required",
        "biodiversity_priority",
        "native_species_preference",
    ):
        return "preference"
    if col in ("project_type", "area_sqft", "usable_area_pct", "floor_level", "wind_exposure", "load_capacity_level", "railing_height_ft", "surface_type", "roof_material", "access_ease", "drainage_quality", "waterproofing_status"):
        return "project_structure"
    if col in (
        "city_tier",
        "climate_zone",
        "region",
        "sunlight_hours",
        "shade_level",
        "ambient_heat_severity",
        "avg_summer_temp_c",
        "humidity_pct",
        "rainfall_level",
        "air_quality_level",
        "dust_exposure",
        "water_availability",
        "irrigation_possible",
        "orientation",
        "surrounding_built_density",
    ):
        return "environment"
    if col in (
        "recommendation_type",
        "greenery_density",
        "planter_type",
        "irrigation_type",
        "shade_solution",
        "cooling_strategy",
        "maintenance_level_pred",
        "species_mix_type",
        "species_count_estimate",
        "estimated_install_cost_inr",
        "estimated_annual_maintenance_inr",
        "expected_temp_reduction_c",
        "expected_surface_temp_reduction_c",
    ):
        return "candidate_solution"
    return "other"


def feature_list_for_task(task: str) -> tuple[str, ...]:
    if task == "feasibility":
        return FEASIBILITY_V1_FEATURES
    if task in ("heat_score", "heat_mitigation"):
        return HEAT_MITIGATION_V1_FEATURES
    if task == "ranking":
        return RANKING_V1_FEATURES
    raise ValueError(f"unknown task {task}")


def build_pointwise_features(
    pointwise: pd.DataFrame,
    task: str,
    species_csv: Path | None,
    target_column: str,
) -> tuple[pd.DataFrame, FeatureManifest]:
    """
    Add species-derived columns when ``species_primary`` exists; intersect with registry feature list.
    """
    want = list(feature_list_for_task(task))

    df = add_species_primary_features(pointwise, species_csv)
    present = [c for c in want if c in df.columns]
    dropped = [c for c in want if c not in df.columns]
    leak = [c for c in present if c in LABEL_LEAKAGE_COLUMNS]
    if leak:
        raise ValueError(f"label leakage into X: {leak}")

    X = df[present].copy()
    schema = infer_schema(X, present)

    entries: list[FeatureEntry] = []
    groups: dict[str, list[str]] = {}
    for c in present:
        g = _group_for_feature(c)
        groups.setdefault(g, []).append(c)
        enc = "one_hot" if c in schema.categorical else "numeric_pass_through"
        entries.append(
            FeatureEntry(
                name=c,
                group=g,
                dtype=str(X[c].dtype),
                encoding=enc,
                missing_policy="median" if c in schema.numeric else "constant_missing",
                normalization="tree_model_internal" if enc == "numeric_pass_through" else "none",
                source_columns=[c],
            ),
        )

    manifest = FeatureManifest(
        task=task,
        feature_names=present,
        feature_groups=groups,
        entries=entries,
        dropped_columns=dropped,
        target_column=target_column,
        species_csv_used=str(species_csv) if species_csv else None,
        row_counts={"n_rows_input": len(pointwise), "n_rows_features": len(X)},
    )
    return X, manifest
