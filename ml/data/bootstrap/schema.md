# Synthetic bootstrap dataset — column schema

**Purpose:** Train / pre-train models for species suggestion, layout/cooling heuristics, maintenance and feasibility scoring.  
**Provenance:** Rows are **synthetic**; replace with validated horticulture + metering data for production.  
**Generator:** `generate_synthetic_dataset.py` → `synthetic_bootstrap/` package.  
**Phase 2 layout:** `outputs/raw/` (normalized tables), `outputs/processed/` (training joins), `outputs/processed/splits/` (train/val/test by `project_id`).  
**Config:** `config/generation_rules.json`, `config/species_library.json`.

| Column | Type | Role | Description | Example values |
|--------|------|------|-------------|----------------|
| `sample_id` | string | metadata | Deterministic synthetic key | `SYN-000042-000001` |
| `project_type` | categorical | feature | Built form | `rooftop`, `terrace`, `balcony` |
| `city_tier` | categorical | feature | Market / infra tier | `tier_1` … `tier_4` |
| `climate_zone` | categorical | feature | Broad climate bucket | `tropical_humid`, `semi_arid` |
| `region` | categorical | feature | Metro / region label | `NCR`, `Mumbai_MMR`, `Other` |
| `area_sqft` | float | feature | Declared usable floor area | `120.5`, `2400` |
| `usable_area_pct` | float | feature | % of footprint usable for planters | `72.0` |
| `sunlight_hours` | float | feature | Typical daily direct sun | `4.2`, `9.8` |
| `shade_level` | categorical | feature | Qualitative shade | `none`, `low`, `medium`, `high` |
| `floor_level` | int | feature | Storey (ordinal proxy for wind/exposure) | `3`, `18` |
| `wind_exposure` | float | feature | Normalized exposure index 0–1 | `0.42` |
| `load_capacity_level` | categorical | feature | Structural headroom for weight | `low`, `medium`, `high` |
| `railing_height_ft` | float | feature | Safety / containment | `3.5` |
| `waterproofing_status` | categorical | feature | Membrane condition | `good`, `fair`, `poor` |
| `drainage_quality` | categorical | feature | Runoff / ponding risk | `poor`, `ok`, `good` |
| `access_ease` | categorical | feature | Logistics for install/maintain | `difficult`, `moderate`, `easy` |
| `surface_type` | categorical | feature | Walking / mounting surface | `concrete`, `tiles`, `green_roof_mat` |
| `roof_material` | categorical | feature | Structural deck material | `rcc`, `metal_sheet` |
| `ambient_heat_severity` | categorical | feature | UHI / exposure severity | `low` … `extreme` |
| `avg_summer_temp_c` | float | feature | Typical peak-season ambient | `36.5` |
| `humidity_pct` | int | feature | Relative humidity | `62` |
| `rainfall_level` | categorical | feature | Monsoon / annual pattern | `dry`, `moderate`, `heavy_monsoon` |
| `air_quality_level` | categorical | feature | PM / smog stress | `good` … `very_poor` |
| `dust_exposure` | categorical | feature | Foliage soiling / filtration need | `low`, `medium`, `high` |
| `water_availability` | categorical | feature | Hose / tank / municipal | `scarce` … `plentiful` |
| `irrigation_possible` | int (0/1) | feature | Allowed to install irrigation | `0`, `1` |
| `orientation` | categorical | feature | Primary solar aspect | `S`, `mixed` |
| `surrounding_built_density` | categorical | feature | Canyon / wind / shading context | `low` … `very_high` |
| `budget_inr` | int | feature | Stated install budget (INR) | `85000` |
| `maintenance_preference` | categorical | feature | User time budget | `minimal` … `high` |
| `aesthetic_style` | categorical | feature | Design intent | `minimal_modern`, `kitchen_garden` |
| `purpose_primary` | categorical | feature | Main goal | `cooling`, `food`, `privacy` |
| `child_pet_safe_required` | int (0/1) | feature | Hard filter on toxic species | `0`, `1` |
| `edible_plants_preferred` | int (0/1) | feature | Bias to food plants | `0`, `1` |
| `flowering_preferred` | int (0/1) | feature | Bias to bloom / pollinators | `0`, `1` |
| `privacy_required` | int (0/1) | feature | Screening / height value | `0`, `1` |
| `seating_required` | int (0/1) | feature | Space competition with planters | `0`, `1` |
| `shade_required` | int (0/1) | feature | Demand for passive shade | `0`, `1` |
| `biodiversity_priority` | int (0/1) | feature | Polyculture / native mix | `0`, `1` |
| `native_species_preference` | int (0/1) | feature | Prefer regional natives | `0`, `1` |
| `recommendation_type` | categorical | target / label | Solution archetype | `herb_focused`, `succulent_forward` |
| `greenery_density` | categorical | target / label | Planting intensity | `sparse` … `very_dense` |
| `planter_type` | categorical | target / label | Container system | `terracotta`, `modular_rail_planters` |
| `irrigation_type` | categorical | target / label | Water delivery | `manual_watering`, `drip_smart` |
| `shade_solution` | categorical | target / label | Passive / active shade | `shade_net_50`, `none` |
| `cooling_strategy` | categorical | target / label | ET + shading approach | `combined_shade_et` |
| `maintenance_level_pred` | categorical | target / label | Predicted upkeep band | `L0_minimal` … `L3_intensive` |
| `estimated_install_cost_inr` | float | target / label | Heuristic cost | `142000.5` |
| `estimated_annual_maintenance_inr` | float | target / label | Year-1 maintain estimate | `12000` |
| `expected_temp_reduction_c` | float | target / label | Air temp delta (heuristic) | `3.2` |
| `expected_surface_temp_reduction_c` | float | target / label | Surface delta | `5.1` |
| `pollinator_support_score` | float [0,1] | target / label | Pollinator habitat value | `0.62` |
| `privacy_score` | float [0,1] | target / label | Visual screening | `0.41` |
| `feasibility_score` | float [0,1] | target / label | Structural / ops feasibility | `0.78` |
| `safety_score` | float [0,1] | target / label | Railing / toxicity / trip risk | `0.89` |
| `species_primary` | string | target / label | Main species (display name) | `Holy basil (tulsi)` |
| `species_secondary` | string | target / label | Second slot | `Marigold` |
| `species_tertiary` | string | target / label | Third slot | `Marigold` |
| `species_mix_type` | categorical | target / label | Composition pattern | `duo_complement` |
| `species_count_estimate` | int | target / label | Effective species slots used | `2` |
| `recommendation_acceptance_likelihood` | float [0,1] | target / label | Synthetic propensity | `0.61` |
| `long_term_success_likelihood` | float [0,1] | target / label | Survival / retention prior | `0.52` |
| `heat_mitigation_score` | float [0,1] | target / label | Normalized cooling utility | `0.71` |
| `water_efficiency_score` | float [0,1] | target / label | Water vs outcome | `0.68` |
| `overall_recommendation_score` | float [0,1] | target / label | Composite quality | `0.66` |

**Notes**

- **Features** = everything a model may consume at recommendation time (identifiers + space + env + prefs).  
- **Targets / labels** = solution and scoring columns produced by the in-generator heuristic engine (not observed user behavior).  
- **Metadata** = `sample_id` (synthetic key; exclude from models if leakage-sensitive).  
- Join species to a future canonical catalog via normalized `species.key` when you add a stable ID column.

---

## Normalized ML tables (default CLI)

| File | Rows | Description |
|------|------|-------------|
| `outputs/raw/projects.csv` | 1 per `project_id` | Site + preference features |
| `outputs/raw/candidates.csv` | ∑K per project | `rank_position`, `best_candidate`, solution + species + scores |
| `outputs/raw/ranking_pairs.csv` | ∑ C(K,2) per project | Pairwise preferences (`preference_label` = 1) |
| `outputs/raw/species_features.csv` | 1 per species | Library attributes (see `data_dictionary.md`) |
| `outputs/processed/joined_training_table.csv` | = candidates | Candidates ⋈ projects on `project_id` for pointwise training |
| `outputs/processed/splits/{split}/` | filtered | Same logical files, split by `project_id` only |

**Splits:** `split_manifest.csv` assigns each `project_id` to exactly one of `train` / `val` / `test`. Small N can yield an empty `val` split when `int(n * val_ratio) == 0`.

**Legacy:** `run_ranking_pipeline` can still emit `ranking_long_form.csv` for debugging; the default path is the normalized layout above.
