"""
Column groupings for HeatWise v1 training (aligned with bootstrap ``joined_training_table``).

Use these lists to build X; never mix label columns into X for production scoring models.
"""

from __future__ import annotations

from typing import Final

# --- Metadata (exclude from supervised X or use only for grouping / splits) ---
ID_COLUMNS: Final[tuple[str, ...]] = ("project_id", "candidate_id", "sample_id")

# --- 1) Project structure (physical site) ---
PROJECT_STRUCTURE_FEATURES: Final[tuple[str, ...]] = (
    "project_type",
    "area_sqft",
    "usable_area_pct",
    "floor_level",
    "wind_exposure",
    "load_capacity_level",
    "railing_height_ft",
    "surface_type",
    "roof_material",
    "access_ease",
    "drainage_quality",
    "waterproofing_status",
)

# --- 2) User / product preferences ---
PREFERENCE_FEATURES: Final[tuple[str, ...]] = (
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
)

# --- 3) Environmental / location context ---
ENVIRONMENT_FEATURES: Final[tuple[str, ...]] = (
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
)

# --- 4) Proposed solution (candidate) descriptors — safe as inputs for scoring/ranking ---
CANDIDATE_SOLUTION_FEATURES: Final[tuple[str, ...]] = (
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
)

# --- 5) Species slot names (join to ``species_features.csv`` in preprocess; not raw X) ---
SPECIES_SLOT_COLUMNS: Final[tuple[str, ...]] = (
    "species_primary",
    "species_secondary",
    "species_tertiary",
)

# Derived species attributes after join (see ``training_spec.md``)
SPECIES_DERIVED_NUMERIC: Final[tuple[str, ...]] = (
    "species_primary_cooling_contribution",
    "species_primary_water_demand_ord",
    "species_primary_pollinator_value",
    "species_primary_edible_flag",
    "species_primary_privacy_contribution",
)

SPECIES_DERIVED_CATEGORICAL: Final[tuple[str, ...]] = (
    "species_primary_container_suitability",
    "species_primary_growth_habit",
)

# --- v1 model feature sets (no leakage: other scores / labels excluded) ---

FEASIBILITY_V1_FEATURES: Final[tuple[str, ...]] = (
    *PROJECT_STRUCTURE_FEATURES,
    *PREFERENCE_FEATURES,
    *ENVIRONMENT_FEATURES,
    *CANDIDATE_SOLUTION_FEATURES,
    *SPECIES_DERIVED_NUMERIC,
    *SPECIES_DERIVED_CATEGORICAL,
)

HEAT_MITIGATION_V1_FEATURES: Final[tuple[str, ...]] = FEASIBILITY_V1_FEATURES

# Ranking: same base representation per candidate; listwise training adds group key ``project_id``
RANKING_V1_FEATURES: Final[tuple[str, ...]] = FEASIBILITY_V1_FEATURES

# Columns that must never appear in X when training a scorer for deployment
LABEL_LEAKAGE_COLUMNS: Final[tuple[str, ...]] = (
    "feasibility_score",
    "heat_mitigation_score",
    "safety_score",
    "pollinator_support_score",
    "privacy_score",
    "recommendation_acceptance_likelihood",
    "long_term_success_likelihood",
    "water_efficiency_score",
    "overall_recommendation_score",
    "best_candidate",
    "rank_position",
)


def features_for_task(task: str) -> tuple[str, ...]:
    """Return feature column names for ``feasibility`` | ``heat_mitigation`` | ``ranking``."""
    if task == "feasibility":
        return FEASIBILITY_V1_FEATURES
    if task == "heat_mitigation":
        return HEAT_MITIGATION_V1_FEATURES
    if task == "ranking":
        return RANKING_V1_FEATURES
    raise ValueError(f"unknown task: {task}")
