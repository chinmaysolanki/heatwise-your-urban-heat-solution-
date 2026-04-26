"""
Categorical vocabularies and column ordering.

Edit registries here to extend taxonomy without touching generation logic.
"""

from __future__ import annotations

from typing import Final, Literal

# --- Profile names (CLI --profile) ---
ProfileName = Literal[
    "balanced",
    "budget",
    "premium",
    "hot-climate",
    "balcony-heavy",
    "rooftop-heavy",
]

PROJECT_TYPES: Final[tuple[str, ...]] = ("rooftop", "terrace", "balcony")
CITY_TIERS: Final[tuple[str, ...]] = ("tier_1", "tier_2", "tier_3", "tier_4")
CLIMATE_ZONES: Final[tuple[str, ...]] = (
    "tropical_humid",
    "tropical_dry",
    "semi_arid",
    "composite_monsoon",
)
REGIONS: Final[tuple[str, ...]] = (
    "NCR",
    "Mumbai_MMR",
    "Bangalore",
    "Hyderabad",
    "Chennai",
    "Pune",
    "Kolkata",
    "Ahmedabad",
    "Jaipur",
    "Kochi",
    "Indore",
    "Lucknow",
    "Other",
)

SHADE_LEVELS: Final[tuple[str, ...]] = ("none", "low", "medium", "high")
LOAD_CAPACITY_LEVELS: Final[tuple[str, ...]] = ("low", "medium", "high", "unknown")
WATERPROOFING: Final[tuple[str, ...]] = ("good", "fair", "poor", "unknown")
DRAINAGE_QUALITY: Final[tuple[str, ...]] = ("poor", "ok", "good")
ACCESS_EASE: Final[tuple[str, ...]] = ("difficult", "moderate", "easy")

SURFACE_TYPES: Final[tuple[str, ...]] = (
    "concrete",
    "tiles",
    "wood_deck",
    "metal_deck",
    "soil_patch",
    "green_roof_mat",
    "mixed",
)
ROOF_MATERIALS: Final[tuple[str, ...]] = (
    "rcc",
    "metal_sheet",
    "tiles",
    "wood",
    "unknown",
)
HEAT_SEVERITY: Final[tuple[str, ...]] = ("low", "moderate", "high", "extreme")
RAINFALL_LEVEL: Final[tuple[str, ...]] = ("dry", "moderate", "heavy_monsoon")
AIR_QUALITY: Final[tuple[str, ...]] = ("good", "moderate", "poor", "very_poor")
DUST_EXPOSURE: Final[tuple[str, ...]] = ("low", "medium", "high")
WATER_AVAILABILITY: Final[tuple[str, ...]] = ("scarce", "limited", "adequate", "plentiful")
ORIENTATIONS: Final[tuple[str, ...]] = (
    "N",
    "NE",
    "E",
    "SE",
    "S",
    "SW",
    "W",
    "NW",
    "mixed",
)
BUILT_DENSITY: Final[tuple[str, ...]] = ("low", "medium", "high", "very_high")

MAINTENANCE_PREF: Final[tuple[str, ...]] = ("minimal", "low", "moderate", "high")
AESTHETIC_STYLES: Final[tuple[str, ...]] = (
    "minimal_modern",
    "tropical_lush",
    "mediterranean",
    "native_wild",
    "kitchen_garden",
    "zen_sparse",
    "colorful_annuals",
)
PURPOSE_PRIMARY: Final[tuple[str, ...]] = (
    "cooling",
    "food",
    "privacy",
    "aesthetics",
    "biodiversity",
    "low_maintenance_green",
    "mixed",
)

RECOMMENDATION_TYPES: Final[tuple[str, ...]] = (
    "planters_only",
    "raised_beds",
    "green_wall_lite",
    "shade_first_greenery",
    "intensive_green_roof_lite",
    "succulent_forward",
    "herb_focused",
    "mixed_canopy_lite",
)
GREENERY_DENSITY: Final[tuple[str, ...]] = ("sparse", "moderate", "dense", "very_dense")
PLANTER_TYPES: Final[tuple[str, ...]] = (
    "plastic_basic",
    "terracotta",
    "fabric_grow_bag",
    "wooden_box",
    "metal_trough",
    "concrete_custom",
    "modular_rail_planters",
    "vertical_stack",
)
IRRIGATION_TYPES: Final[tuple[str, ...]] = (
    "manual_watering",
    "drip_timer",
    "drip_smart",
    "subirrigation",
    "rainfed_only",
)
SHADE_SOLUTIONS: Final[tuple[str, ...]] = (
    "none",
    "shade_net_50",
    "shade_net_75",
    "pergola_lite",
    "umbrella_portable",
    "companion_tall_plants",
)
COOLING_STRATEGIES: Final[tuple[str, ...]] = (
    "evapotranspiration_light",
    "evapotranspiration_heavy",
    "surface_shading",
    "reflective_mulch",
    "combined_shade_et",
)

SPECIES_MIX_TYPES: Final[tuple[str, ...]] = (
    "single_species",
    "duo_complement",
    "tri_layer_simple",
    "polyculture_lite",
)

# Ordered CSV columns (matches schema.md)
OUTPUT_COLUMNS: Final[tuple[str, ...]] = (
    "sample_id",
    "project_type",
    "city_tier",
    "climate_zone",
    "region",
    "area_sqft",
    "usable_area_pct",
    "sunlight_hours",
    "shade_level",
    "floor_level",
    "wind_exposure",
    "load_capacity_level",
    "railing_height_ft",
    "waterproofing_status",
    "drainage_quality",
    "access_ease",
    "surface_type",
    "roof_material",
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
    "recommendation_type",
    "greenery_density",
    "planter_type",
    "irrigation_type",
    "shade_solution",
    "cooling_strategy",
    "maintenance_level_pred",
    "estimated_install_cost_inr",
    "estimated_annual_maintenance_inr",
    "expected_temp_reduction_c",
    "expected_surface_temp_reduction_c",
    "pollinator_support_score",
    "privacy_score",
    "feasibility_score",
    "safety_score",
    "species_primary",
    "species_secondary",
    "species_tertiary",
    "species_mix_type",
    "species_count_estimate",
    "recommendation_acceptance_likelihood",
    "long_term_success_likelihood",
    "heat_mitigation_score",
    "water_efficiency_score",
    "overall_recommendation_score",
)

# Index where solution / recommendation outputs begin (after user + env inputs).
_REC_START = OUTPUT_COLUMNS.index("recommendation_type")

# One row per physical site (no candidate-level outputs).
PROJECT_FEATURE_COLUMNS: Final[tuple[str, ...]] = ("project_id",) + OUTPUT_COLUMNS[:_REC_START]

# Candidate-level solution + labels (for ranking / pairwise tables).
CANDIDATE_SOLUTION_COLUMNS: Final[tuple[str, ...]] = OUTPUT_COLUMNS[_REC_START:]

# Long-form ranking export (training pairwise / LTR).
RANKING_EXTRA_COLUMNS: Final[tuple[str, ...]] = (
    "project_id",
    "candidate_id",
    "rank_position",
    "best_candidate",
)
