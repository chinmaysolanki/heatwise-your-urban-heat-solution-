# HeatWise Species Dataset — Field Reference

Generated: 2026-04-02T08:08:51.451Z
Format: UTF-8 CSV (species_dataset_full.csv) + ML CSV (species_dataset_ml.csv) + JSON seed

---

## Column Groups

### A — IDENTITY FIELDS

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| code | string | seed | Canonical identifier used across DB, ML models, and app (e.g. `tulsi_holy`). Snake-case, unique. |
| display_name | string | seed | User-facing plant name (e.g. "Holy basil (Tulsi)"). |
| scientific_name | string | seed / GBIF | Binomial or genus-level name (e.g. "Ocimum tenuiflorum"). |
| family | string | GBIF / Perenual | Taxonomic family (e.g. "Lamiaceae"). |
| genus | string | GBIF | Taxonomic genus. |
| kingdom | string | GBIF | Always "Plantae". |
| category | string (enum) | derived | `HERB | VEGETABLE | SUCCULENT | ORNAMENTAL | FOLIAGE | GRASS | CLIMBER | SHRUB`. |
| growth_habit | string | derived | Mirrors category for ML CSV column. |
| cycle | string | Perenual | Annual / Biennial / Perennial / Biannual. |
| native_range_notes | string | Wikipedia | Short native range description (≤200 chars). |
| invasive_risk | string | Perenual | HIGH / LOW — whether listed as invasive by Perenual. |
| hardiness_zone_min | int? | Trefle (not yet) | Minimum USDA hardiness zone. Null until Trefle token provided. |
| hardiness_zone_max | int? | Trefle (not yet) | Maximum USDA hardiness zone. |
| max_height_cm | float? | Trefle (not yet) | Maximum expected height in cm. |

---

### B — DB BOOLEAN TRAITS  (maps to SpeciesCatalog Prisma model)

These drive hard-exclusion filters in the recommendation engine.

| Column | Type | Source | Recommendation Engine Role |
|--------|------|--------|---------------------------|
| edible | bool | seed / Perenual | `edibleDominanceTopOpen` — enforces edible-herb ratios in scenarios |
| flowering | bool | seed / derived | `showyFullSunOrnamental` — demotes showy non-cooling ornamentals in scarce-water setups |
| pet_safe | bool | seed / Perenual | `HARD_PET_UNSAFE_SPECIES` — hard-excludes if `child_pet_safe_required=1` in scenario |
| drought_tolerant | bool | seed / derived | `waterScarcityHardExclude` — hard-excludes MED/unknown demand plants unless this is true |
| heat_tolerant | bool | seed / derived | `shadeSunMismatchHardExclude` — prevents shade-loving plants on full-sun sites |
| low_maintenance | bool | seed / Perenual | `maintenanceNudge` — boosts low-maintenance plants in low-skill scenarios |

---

### C — SUN HOUR FIELDS  (maps to SpeciesCatalog)

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| min_sun_hours | int | seed / Perenual | Minimum direct sun hours tolerated in containers on a roof. Used in `effectiveSunlightPrefNorm()`. |
| max_sun_hours | int | seed / Perenual | Maximum direct sun hours tolerated. |
| sunlight_preference | string | Perenual | `FULL | PART | SHADE` — reconciled preference label. Used in `sunMatch()`. |

---

### D — ML FEATURE FIELDS  (maps to species_features.csv for catalogHybridFallback)

| Column | Type | Values | Scoring Function |
|--------|------|--------|-----------------|
| climate_suitability | string | Pipe-delimited tokens: `HOT_HUMID|HOT_DRY|HOT_SEMI_ARID|MONSOON_HEAVY|TROPICAL|SUBTROPICAL|MEDITERRANEAN|TEMPERATE` | Climate match scoring |
| water_demand | string | `LOW|MED|HIGH` | `effectiveWaterDemandNorm()`, `waterScarcityHardExclude()`, `scarceWaterPriorityFactor()` |
| maintenance_need | string | `LOW|MED|HIGH` | Maintenance scoring nudge |
| root_aggressiveness | string | `LOW|MED|HIGH` | Container suitability filter |
| pollinator_value | float | 0.0–3.0 | Ecosystem benefit scoring |
| child_pet_safety | string | `SAFE|CAUTION|UNSAFE` | Pet-safe scenario filter (reconciled with pet_safe bool) |
| native_support | string | `LOW|HIGH` | Ecological scoring bonus |
| container_suitability | string | `POOR|GOOD|EXCELLENT` | Rooftop/balcony eligibility filter |
| cooling_contribution | float | 0.0–3.0 | Primary scoring signal — heat reduction potential |
| privacy_contribution | float | 0.0–3.0 | Privacy benefit scoring |
| drought_tolerance | string | `LOW|MED|HIGH` | Legacy vocab field — mirrors drought_tolerant bool |

---

### E — COOLING CONTRIBUTION SCORING GUIDE

| Score | Meaning | Typical Plants |
|-------|---------|---------------|
| 3.0 | Maximum cooling — dense wall coverage | Climbers (Bougainvillea, Money plant, Thunbergia) |
| 2.8 | Excellent — high ET + large canopy | Tropical foliage with high watering |
| 2.5 | Very good — grass density or shrub coverage | Lemongrass, Bamboo, dense Shrubs |
| 2.0 | Good — moderate foliage + partial shade | Hibiscus, Ornamentals with full sun |
| 1.5 | Moderate — herbs, small edibles | Vegetables, most herbs |
| 0.9 | Low — sparse leaf area | Succulents, Cacti |
| 0.5 | Minimal — decorative only | Flowering bulbs |

---

### F — IMAGE FIELDS

| Column | Description |
|--------|-------------|
| image_url | Full-resolution image URL (Perenual preferred, Wikimedia fallback) |
| image_thumbnail | Thumbnail URL for app display |
| image_license | License string (e.g. "CC BY-SA 4.0") |
| image_source | Origin: `perenual | wikipedia | wikimedia` |
| image_local_path | Relative path to downloaded image in species_images/ |

---

### G — PROVENANCE FIELDS

| Column | Description |
|--------|-------------|
| source_perenual | yes/no — data fetched from Perenual API |
| source_gbif | yes/no — taxonomy confirmed via GBIF |
| source_wikipedia | yes/no — description pulled from Wikipedia |
| source_seed | yes/no — present in curated HeatWise seed (always "yes") |
| confidence | 0.0–1.0 — how many sources corroborated this record |

---

## Selection Parameters — How Species Are Chosen for Recommendations

The recommendation engine applies these parameters as filters in order:

1. **Hard Exclusion — Sun Mismatch** (`shadeSunMismatchHardExclude`)
   - Exclude if `sunlight_preference = FULL` and site sun_hours < 2
   - Exclude if `min_sun_hours > site_sun_hours + 0.75`

2. **Hard Exclusion — Water Scarcity** (`waterScarcityHardExclude`)
   - Exclude `water_demand = HIGH` unconditionally when `water_availability = scarce`
   - Exclude `water_demand = MED` unless `drought_tolerant = true`
   - Exclude unknown demand unless `drought_tolerant = true`

3. **Hard Exclusion — Pet Safety** (`HARD_PET_UNSAFE_SPECIES`)
   - Exclude all species where `pet_safe = false` when scenario has `child_pet_safe_required = 1`

4. **Container Suitability Filter**
   - Exclude `container_suitability = POOR` on rooftop/balcony space types

5. **Priority Boosts / Demotions** (`scarceWaterPriorityFactor`)
   - `water_demand = LOW` + `drought_tolerant = true` → **1.30×** boost
   - `water_demand = LOW` alone → **1.12×** boost
   - `water_demand = MED` + `drought_tolerant = true` → **0.90×** demotion
   - Showy ornamental (non-edible + flowering + full-sun + `pollinator_value ≥ 3`) → **0.58×** demotion in scarce-water

6. **Scoring** — weighted sum:
   - `cooling_contribution` × cooling weight
   - `sunMatch(sunlight_preference, site_bucket)` × sun weight
   - `pollinator_value` × ecosystem weight
   - `container_suitability` bonus
   - `ml_weight` multiplier (per-species model output)

---

*Dataset generated by HeatWise species scraper — scripts/scrape-species-dataset.mjs*
