# Data dictionary — HeatWise synthetic bootstrap

Convention: **feature** = model input, **target** = supervised signal (synthetic), **metadata** = IDs / bookkeeping.

## `projects.csv` / `project_features.csv`

| Field | Type | Role | Description / range |
|-------|------|------|---------------------|
| `project_id` | string | metadata | Stable synthetic site ID, `PRJ-{seed}-{idx}` |
| `sample_id` | string | metadata | Same as `project_id` in ranking pipeline |
| `project_type` | string | feature | `rooftop`, `terrace`, `balcony` |
| `city_tier` | string | feature | `tier_1` … `tier_4` |
| `climate_zone` | string | feature | e.g. `tropical_humid`, `semi_arid` |
| `region` | string | feature | Metro / bucket label |
| `area_sqft` | float | feature | Declared usable area, > 0 |
| `usable_area_pct` | float | feature | 0–100 |
| `sunlight_hours` | float | feature | Typical daily direct sun |
| `shade_level` | string | feature | `none`, `low`, `medium`, `high` |
| `floor_level` | int | feature | Storey index |
| `wind_exposure` | float | feature | 0–1 normalized |
| `load_capacity_level` | string | feature | `low`, `medium`, `high`, `unknown` |
| `railing_height_ft` | float | feature | Safety / containment |
| `waterproofing_status` | string | feature | `good`, `fair`, `poor`, `unknown` |
| `drainage_quality` | string | feature | `poor`, `ok`, `good` |
| `access_ease` | string | feature | `difficult`, `moderate`, `easy` |
| `surface_type` | string | feature | See `registries.SURFACE_TYPES` |
| `roof_material` | string | feature | e.g. `rcc`, `metal_sheet` |
| `ambient_heat_severity` | string | feature | `low` … `extreme` |
| `avg_summer_temp_c` | float | feature | Typical peak-season ambient |
| `humidity_pct` | int | feature | 0–100 |
| `rainfall_level` | string | feature | `dry`, `moderate`, `heavy_monsoon` |
| `air_quality_level` | string | feature | `good` … `very_poor` |
| `dust_exposure` | string | feature | `low`, `medium`, `high` |
| `water_availability` | string | feature | `scarce` … `plentiful` |
| `irrigation_possible` | int | feature | 0 / 1 |
| `orientation` | string | feature | Cardinal / `mixed` |
| `surrounding_built_density` | string | feature | `low` … `very_high` |
| `budget_inr` | int | feature | Stated install budget (INR) |
| `maintenance_preference` | string | feature | `minimal` … `high` |
| `aesthetic_style` | string | feature | Design intent bucket |
| `purpose_primary` | string | feature | `cooling`, `food`, etc. |
| `child_pet_safe_required` | int | feature | 0 / 1 hard filter |
| `edible_plants_preferred` | int | feature | 0 / 1 |
| `flowering_preferred` | int | feature | 0 / 1 |
| `privacy_required` | int | feature | 0 / 1 |
| `seating_required` | int | feature | 0 / 1 |
| `shade_required` | int | feature | 0 / 1 |
| `biodiversity_priority` | int | feature | 0 / 1 |
| `native_species_preference` | int | feature | 0 / 1 |

## `candidates.csv`

| Field | Type | Role | Description / range |
|-------|------|------|---------------------|
| `candidate_id` | string | metadata | Unique per row |
| `project_id` | string | metadata | FK to projects |
| `rank_position` | int | target / metadata | 1 = best within project, contiguous 1…K |
| `best_candidate` | int | target | 1 on rank 1 only, else 0 |
| `recommendation_type` | string | target | Solution archetype |
| `greenery_density` | string | target | `sparse` … `very_dense` |
| `planter_type` | string | target | Container system |
| `irrigation_type` | string | target | Water delivery mode |
| `shade_solution` | string | target | Shade approach |
| `cooling_strategy` | string | target | ET / shading strategy |
| `maintenance_level_pred` | string | target | `L0_minimal` … `L3_intensive` |
| `estimated_install_cost_inr` | float | target | Heuristic cost |
| `estimated_annual_maintenance_inr` | float | target | Year-1 maintain estimate |
| `expected_temp_reduction_c` | float | target | Heuristic air delta |
| `expected_surface_temp_reduction_c` | float | target | Surface delta |
| `pollinator_support_score` | float | target | [0, 1] |
| `privacy_score` | float | target | [0, 1] |
| `feasibility_score` | float | target | [0, 1] |
| `safety_score` | float | target | [0, 1] |
| `recommendation_acceptance_likelihood` | float | target | [0, 1] |
| `long_term_success_likelihood` | float | target | [0, 1] |
| `heat_mitigation_score` | float | target | [0, 1] |
| `water_efficiency_score` | float | target | [0, 1] |
| `overall_recommendation_score` | float | target | [0, 1], non-increasing with rank |
| `species_primary` | string | target | Display name |
| `species_secondary` | string | target | Display name |
| `species_tertiary` | string | target | Display name |
| `species_mix_type` | string | target | Mix pattern |
| `species_count_estimate` | int | target | Effective slots |

## `ranking_pairs.csv`

| Field | Type | Role | Description |
|-------|------|------|-------------|
| `project_id` | string | metadata | Scope of comparison |
| `preferred_candidate_id` | string | metadata | Better candidate (lower rank) |
| `other_candidate_id` | string | metadata | Worse candidate |
| `preference_label` | int | target | Always `1` in this export |

## `species_features.csv`

| Field | Type | Role | Description |
|-------|------|------|-------------|
| `species_name` | string | feature | Display / join key |
| `climate_suitability` | string | feature | Pipe-separated tags |
| `sunlight_preference` | string | feature | `FULL`, `PART`, `SHADE` |
| `water_demand` | string | feature | `LOW`, `MED`, `HIGH` |
| `maintenance_need` | string | feature | `LOW`, `MED`, `HIGH` |
| `root_aggressiveness` | string | feature | `LOW`, `MED`, `HIGH` |
| `pollinator_value` | int | feature | 0–3 |
| `edible_flag` | int | feature | 0 / 1 |
| `child_pet_safe` | string | feature | `SAFE`, `CAUTION`, `UNSAFE` |
| `native_support` | string | feature | `HIGH`, `MED`, `LOW` |
| `container_suitability` | string | feature | `EXCELLENT` … `POOR` |
| `cooling_contribution` | int | feature | 0–3 |
| `privacy_contribution` | int | feature | 0–3 |
| `growth_habit` | string | feature | e.g. `HERB`, `SHRUB` |

## `recommendation_labels.csv`

Subset of `candidates.csv` columns listed in `synthetic_bootstrap.table_schemas.LABEL_COLUMNS` (IDs, rank, `best_candidate`, core scores and cost/temp targets).

## `joined_training_table.csv`

Left: all candidate columns; merged project features on `project_id` (suffix `_proj` only if a name collision occurs—engine avoids duplicate base names).
