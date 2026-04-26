-- ============================================================================
-- HeatWise — Species Catalog Dataset (SQL)
-- ============================================================================
-- File    : data/species/heatwise_species_dataset.sql
-- Version : 1.0  |  Generated : 2026-04-02
-- Engine  : PostgreSQL 14+ / SQLite 3.35+ compatible
--
-- PURPOSE
-- -------
-- Single-source-of-truth for all plant species used by the HeatWise
-- recommendation engine, ML training pipeline, and mobile app catalog.
-- Contains 51 species with all selection parameters, scoring signals,
-- and hard-exclusion rule constraints documented inline.
--
-- HOW THE RECOMMENDATION ENGINE USES THIS TABLE
-- ----------------------------------------------
-- 1. HARD EXCLUSION (shadeSunMismatchHardExclude)
--      Species excluded when site sun hours < min_sun_hours - 0.75
--      Species excluded when sunlight_preference = 'FULL' on shade sites
-- 2. HARD EXCLUSION (waterScarcityHardExclude)
--      water_demand = 'HIGH'        → always excluded when water scarce
--      water_demand = 'MED'  AND drought_tolerant = FALSE → excluded
--      water_demand unknown AND drought_tolerant = FALSE → excluded
-- 3. HARD EXCLUSION (petSafetyHardExclude)
--      pet_safe = FALSE             → excluded when child_pet_safe scenario
-- 4. HARD EXCLUSION (containerSuitabilityFilter)
--      container_suitability = 'POOR' → excluded on rooftop/balcony sites
-- 5. PRIORITY FACTOR (scarceWaterPriorityFactor)
--      LOW demand + drought_tolerant = TRUE   → 1.30x score boost
--      LOW demand alone                       → 1.12x score boost
--      MED demand + drought_tolerant = TRUE   → 0.90x score demotion
--      Showy full-sun ornamental              → 0.58x score demotion
-- 6. PRIMARY SCORING SIGNAL
--      cooling_contribution (0.0–3.0) × cooling_weight
--      sunlight match score × sun_weight
--      pollinator_value × ecosystem_weight
--      ml_weight multiplier
--
-- COLUMN GROUPS
-- -------------
-- A  Identity            : code → image_source
-- B  Boolean Traits      : edible → low_maintenance
-- C  Sun Hours           : min_sun_hours, max_sun_hours
-- D  Vocabulary Scores   : drought_tolerance → container_suitability
-- E  Continuous Scores   : cooling_contribution, privacy_contribution
-- F  Content             : tags_json, notes
-- G  Image               : image_url → image_source
-- H  ML / System         : ml_weight, active, data_confidence
--
-- ============================================================================


-- ============================================================================
-- SECTION 1 — ENUM TYPES
-- (PostgreSQL; SQLite uses CHECK constraints below)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE species_category      AS ENUM ('HERB','VEGETABLE','SUCCULENT','ORNAMENTAL','FOLIAGE','GRASS','CLIMBER','SHRUB');
  CREATE TYPE sunlight_pref         AS ENUM ('FULL','PART','SHADE');
  CREATE TYPE demand_level          AS ENUM ('LOW','MED','HIGH');
  CREATE TYPE pet_safety_level      AS ENUM ('SAFE','CAUTION','UNSAFE');
  CREATE TYPE container_fit         AS ENUM ('POOR','GOOD','EXCELLENT');
  CREATE TYPE invasive_level        AS ENUM ('LOW','MEDIUM','HIGH');
  CREATE TYPE native_support_level  AS ENUM ('LOW','HIGH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- SECTION 2 — TABLE DEFINITION
-- ============================================================================

DROP TABLE IF EXISTS species_scoring_log;
DROP TABLE IF EXISTS species_catalog;

CREATE TABLE species_catalog (

  -- ── A. IDENTITY ─────────────────────────────────────────────────────────
  id                    SERIAL          PRIMARY KEY,

  code                  VARCHAR(80)     NOT NULL UNIQUE,
  -- Canonical snake_case identifier used across DB, ML models, and app.
  -- Must match lib/species/resolveSpeciesCatalogCode.ts resolution keys.
  -- Format: lowercase, underscores only. e.g. 'tulsi_holy', 'aloe_vera'

  display_name          VARCHAR(160)    NOT NULL,
  -- User-facing name shown in the HeatWise app catalog and recommendation cards.

  scientific_name       VARCHAR(200)    NOT NULL DEFAULT '',
  -- Binomial or genus-level botanical name. Used for ASPCA/GBIF cross-referencing.
  -- Drives pet_safe accuracy — must match ASPCA toxicity database names.

  family                VARCHAR(100)    NOT NULL DEFAULT '',
  -- Taxonomic family (e.g. 'Lamiaceae', 'Crassulaceae').
  -- Used for alias resolution and ML feature grouping.

  genus                 VARCHAR(100)    NOT NULL DEFAULT '',
  -- Taxonomic genus. Used for family-level scoring nudges.

  kingdom               VARCHAR(50)     NOT NULL DEFAULT 'Plantae',

  category              VARCHAR(20)     NOT NULL,
  -- Coarse type used for layout zone assignment and coverage logic.
  -- Drives: cooling_contribution baseline, privacy_contribution,
  --         zone placement algorithm in orchestrateLayoutRecommendations.ts
  CONSTRAINT chk_category CHECK (category IN
    ('HERB','VEGETABLE','SUCCULENT','ORNAMENTAL','FOLIAGE','GRASS','CLIMBER','SHRUB')),

  growth_habit          VARCHAR(20)     NOT NULL,
  -- ML CSV field. Mirrors category for the catalogHybridFallback engine.
  CONSTRAINT chk_growth_habit CHECK (growth_habit IN
    ('HERB','VEGETABLE','SUCCULENT','ORNAMENTAL','FOLIAGE','GRASS','CLIMBER','SHRUB','CREEPER','ANNUAL')),

  cycle                 VARCHAR(20)     NOT NULL DEFAULT 'Perennial',
  -- Plant life-cycle. Annual plants may deprioritised for permanent rooftop installs.
  CONSTRAINT chk_cycle CHECK (cycle IN ('Annual','Biennial','Perennial','Biannual')),

  native_range_notes    VARCHAR(300)    NOT NULL DEFAULT '',
  -- Short description of native geographic origin. Used for native_support derivation
  -- and to contextualise climate_suitability token selection.

  invasive_risk         VARCHAR(10)     NOT NULL DEFAULT 'LOW',
  -- Whether species is listed as invasive in common horticultural databases.
  -- HIGH invasive_risk → root_aggressiveness boosted, container_suitability may drop.
  CONSTRAINT chk_invasive_risk CHECK (invasive_risk IN ('LOW','MEDIUM','HIGH')),

  hardiness_zone_min    SMALLINT        NOT NULL DEFAULT 9,
  -- Minimum USDA hardiness zone (1–13). Zone 9–12 covers most of tropical India.
  CONSTRAINT chk_hzone_min CHECK (hardiness_zone_min BETWEEN 1 AND 13),

  hardiness_zone_max    SMALLINT        NOT NULL DEFAULT 12,
  CONSTRAINT chk_hzone_max CHECK (hardiness_zone_max BETWEEN 1 AND 13),
  CONSTRAINT chk_hzone_order CHECK (hardiness_zone_max >= hardiness_zone_min),

  max_height_cm         NUMERIC(8,1)    NOT NULL DEFAULT 100.0,
  -- Maximum expected height in centimetres in container/rooftop conditions.
  -- Used to derive privacy_contribution ceiling and layout zone height class.
  CONSTRAINT chk_max_height CHECK (max_height_cm > 0),


  -- ── B. BOOLEAN SELECTION TRAITS ──────────────────────────────────────────
  -- Each boolean drives at least one hard-exclusion or scoring rule.
  -- See SECTION 4 — SELECTION RULES for the engine mapping.

  edible                BOOLEAN         NOT NULL DEFAULT FALSE,
  -- TRUE  → included in edibleDominanceTopOpen ratio enforcement.
  --         Edible species are never demoted by showyOrnamental demotion.
  -- FALSE → subject to showyFullSunOrnamental 0.58x demotion if also:
  --         flowering=TRUE, sunlight_preference=FULL, pollinator_value >= 3.

  flowering             BOOLEAN         NOT NULL DEFAULT FALSE,
  -- TRUE + !edible + sunlight_preference=FULL + pollinator_value >= 3
  --      → triggers showyFullSunOrnamental 0.58x demotion in scarce-water mode.
  -- TRUE  → contributes to pollinator_value ecosystem scoring bonus.

  pet_safe              BOOLEAN         NOT NULL DEFAULT FALSE,
  -- CRITICAL HARD EXCLUSION:
  -- FALSE → species HARD-EXCLUDED from any scenario with child_pet_safe_required=1.
  -- Source: ASPCA Animal Poison Control database. Must be manually verified.
  -- Drives child_pet_safety column derivation (FALSE → 'UNSAFE').

  drought_tolerant      BOOLEAN         NOT NULL DEFAULT FALSE,
  -- CRITICAL HARD EXCLUSION + PRIORITY:
  -- Used by waterScarcityHardExclude():
  --   water_demand='MED' + drought_tolerant=FALSE → excluded (scarce water)
  --   water_demand=NULL  + drought_tolerant=FALSE → excluded (scarce water)
  -- Used by scarceWaterPriorityFactor():
  --   water_demand='LOW' + drought_tolerant=TRUE  → 1.30x score boost
  --   water_demand='MED' + drought_tolerant=TRUE  → 0.90x score demotion

  heat_tolerant         BOOLEAN         NOT NULL DEFAULT FALSE,
  -- Used by shadeSunMismatchHardExclude():
  --   heat_tolerant=FALSE + site is full sun → score penalised.
  -- Determines suitability for extreme heat zones (heatExposure = 'extreme').

  low_maintenance       BOOLEAN         NOT NULL DEFAULT FALSE,
  -- Used by maintenanceNudge():
  --   low_maintenance=TRUE  → score += maintenanceBonus in low-skill scenarios.
  --   low_maintenance=FALSE → excluded from scenarios with maintenance_level='low'.


  -- ── C. SUN HOUR FIELDS ──────────────────────────────────────────────────

  min_sun_hours         NUMERIC(4,1)    NOT NULL DEFAULT 3.0,
  -- Minimum direct sunlight hours tolerated per day in containers on a rooftop.
  -- HARD EXCLUSION trigger: site_sun_hours < (min_sun_hours - 0.75)
  -- → Species excluded via shadeSunMismatchHardExclude()
  CONSTRAINT chk_min_sun CHECK (min_sun_hours >= 0 AND min_sun_hours <= 16),

  max_sun_hours         NUMERIC(4,1)    NOT NULL DEFAULT 8.0,
  -- Maximum direct sun hours tolerated. Prevents shade plants on full-sun sites.
  CONSTRAINT chk_max_sun CHECK (max_sun_hours >= 0 AND max_sun_hours <= 16),
  CONSTRAINT chk_sun_order CHECK (max_sun_hours >= min_sun_hours),


  -- ── D. VOCABULARY / CATEGORICAL SCORING FIELDS ──────────────────────────

  drought_tolerance     VARCHAR(5)      NOT NULL DEFAULT 'MED',
  -- Legacy vocabulary field for ML CSV backward-compatibility.
  -- HIGH = drought_tolerant=TRUE confirmed; MED = moderate; LOW = water-hungry.
  -- Reconciled with drought_tolerant boolean by effectiveWaterDemandNorm().
  CONSTRAINT chk_drought_tolerance CHECK (drought_tolerance IN ('LOW','MED','HIGH')),

  climate_suitability   VARCHAR(200)    NOT NULL DEFAULT 'TROPICAL|HOT_HUMID',
  -- Pipe-delimited climate tokens. Used to score match with site climate profile.
  -- Valid tokens: HOT_HUMID | HOT_DRY | HOT_SEMI_ARID | MONSOON_HEAVY |
  --               TROPICAL  | SUBTROPICAL | MEDITERRANEAN | TEMPERATE | ALPINE
  -- Engine reads these as: climateSuitabilityScore = matchingTokens / totalSiteTokens
  CONSTRAINT chk_climate_tokens CHECK (
    climate_suitability ~ '^(HOT_HUMID|HOT_DRY|HOT_SEMI_ARID|MONSOON_HEAVY|TROPICAL|SUBTROPICAL|MEDITERRANEAN|TEMPERATE|ALPINE)(\|(HOT_HUMID|HOT_DRY|HOT_SEMI_ARID|MONSOON_HEAVY|TROPICAL|SUBTROPICAL|MEDITERRANEAN|TEMPERATE|ALPINE))*$'
  ),

  sunlight_preference   VARCHAR(6)      NOT NULL DEFAULT 'PART',
  -- Derived preference label used by sunMatch() scoring function:
  --   sunMatch('FULL','FULL')   = 1.00  (perfect)
  --   sunMatch('PART','FULL')   = 0.78  (adjacent tolerance)
  --   sunMatch('SHADE','FULL')  = 0.55  (poor — may also hard-exclude)
  -- Also used by shadeSunMismatchHardExclude() hard filter.
  CONSTRAINT chk_sunlight_pref CHECK (sunlight_preference IN ('FULL','PART','SHADE')),

  water_demand          VARCHAR(5)      NOT NULL DEFAULT 'MED',
  -- Primary water scoring field. Used by:
  --   waterScarcityHardExclude(): HIGH → always excluded (scarce water)
  --   effectiveWaterDemandNorm(): reconciles with drought_tolerant for final demand
  --   scarceWaterPriorityFactor(): LOW + drought_tolerant → 1.30x boost
  -- Source: Perenual 'watering' field mapped: Frequent→HIGH, Average→MED, Minimum→LOW
  CONSTRAINT chk_water_demand CHECK (water_demand IN ('LOW','MED','HIGH')),

  maintenance_need      VARCHAR(5)      NOT NULL DEFAULT 'MED',
  -- Used by maintenance scenario filter and maintenanceNudge scoring.
  -- LOW → matches 'low_maintenance' scenarios; HIGH → excluded from those scenarios.
  -- Source: Perenual 'maintenance' field: Low→LOW, Moderate→MED, High→HIGH
  CONSTRAINT chk_maintenance_need CHECK (maintenance_need IN ('LOW','MED','HIGH')),

  root_aggressiveness   VARCHAR(5)      NOT NULL DEFAULT 'LOW',
  -- Influences container_suitability override logic.
  -- HIGH → container score penalty applied; may override EXCELLENT → GOOD.
  CONSTRAINT chk_root_agg CHECK (root_aggressiveness IN ('LOW','MED','HIGH')),

  pollinator_value      NUMERIC(3,1)    NOT NULL DEFAULT 0.0,
  -- Continuous 0.0–3.0. Ecosystem benefit score.
  -- HIGH pollinator_value (>= 3.0) + flowering + !edible + FULL sun
  --   → triggers showyFullSunOrnamental 0.58x demotion in water-scarce scenarios.
  -- Added to ecosystem_score component of final recommendation score.
  CONSTRAINT chk_pollinator CHECK (pollinator_value BETWEEN 0.0 AND 3.0),

  child_pet_safety      VARCHAR(8)      NOT NULL DEFAULT 'CAUTION',
  -- Reconciled pet-safety label for ML CSV and UI display.
  -- UNSAFE → triggers petSafetyHardExclude (same as pet_safe=FALSE).
  -- CAUTION → displayed with warning in app; not hard-excluded by default.
  -- Source: ASPCA Animal Poison Control. Must match pet_safe boolean.
  CONSTRAINT chk_pet_safety CHECK (child_pet_safety IN ('SAFE','CAUTION','UNSAFE')),
  CONSTRAINT chk_pet_safe_consistency CHECK (
    -- If pet_safe=FALSE then child_pet_safety must be UNSAFE or CAUTION
    (pet_safe = FALSE AND child_pet_safety IN ('UNSAFE','CAUTION'))
    OR pet_safe = TRUE
  ),

  native_support        VARCHAR(5)      NOT NULL DEFAULT 'LOW',
  -- Whether species supports local ecosystem (pollinators, birds).
  -- HIGH → +native_support_bonus in ecosystem scoring component.
  CONSTRAINT chk_native_support CHECK (native_support IN ('LOW','HIGH')),

  container_suitability VARCHAR(10)     NOT NULL DEFAULT 'GOOD',
  -- HARD EXCLUSION for rooftop/balcony space types:
  --   POOR → species excluded from containerFilter in eligibility check.
  --   GOOD → included; EXCELLENT → priority boosted in container scenarios.
  -- Derived from: root_aggressiveness, growth_rate, cycle, description.
  CONSTRAINT chk_container CHECK (container_suitability IN ('POOR','GOOD','EXCELLENT')),


  -- ── E. CONTINUOUS SCORING FIELDS ────────────────────────────────────────

  cooling_contribution  NUMERIC(4,1)    NOT NULL DEFAULT 1.0,
  -- PRIMARY SCORING SIGNAL for heat-reduction recommendations.
  -- Scale 0.0–3.0:
  --   3.0 = Maximum cooling: dense wall-covering climbers (solar block + ET)
  --   2.8 = Excellent: tropical foliage + high evapotranspiration
  --   2.5 = Very good: tall grasses, bamboo (density + ET)
  --   2.0 = Good: shrubs, medium ornamentals in full sun
  --   1.5 = Moderate: most vegetables, large herbs
  --   1.3 = Standard: small herbs, average foliage
  --   0.9 = Low: succulents, cacti (low leaf area)
  --   0.5 = Minimal: decorative-only plants
  -- Multiplied by cooling_weight in weighted scoring formula.
  CONSTRAINT chk_cooling CHECK (cooling_contribution BETWEEN 0.0 AND 3.0),

  privacy_contribution  NUMERIC(4,1)    NOT NULL DEFAULT 0.8,
  -- Secondary scoring signal for privacy/screen scenarios (0.0–3.0).
  -- HIGH privacy species (> 2.0) preferred when layout_type='privacy_screen'.
  CONSTRAINT chk_privacy CHECK (privacy_contribution BETWEEN 0.0 AND 3.0),


  -- ── F. CONTENT FIELDS ───────────────────────────────────────────────────

  tags_json             TEXT            NOT NULL DEFAULT '[]',
  -- JSON array of string tags used for additional filtering and UI display.
  -- Common tags: native_adapted, aromatic, pollinator, container, moist_soil,
  --              drought, full_sun, shade_ok, climber, wall_coverage, monsoon_ok,
  --              medicinal, edible, indoor_ok, privacy_screen, green_roof,
  --              wind_ok, invasive_risk, staking, succulent
  -- Engine reads these via tagsJson field in SpeciesCatalog Prisma model.

  notes                 TEXT            NOT NULL DEFAULT '',
  -- Curator notes for installers and app users. Includes care tips,
  -- rooftop-specific guidance, and any known hazards.


  -- ── G. IMAGE FIELDS ─────────────────────────────────────────────────────

  image_url             TEXT            NOT NULL DEFAULT '',
  -- Full-resolution plant image URL. Perenual preferred (commercial license).
  -- Wikimedia Commons fallback (CC-BY-SA). Must verify license before app use.

  image_thumbnail       TEXT            NOT NULL DEFAULT '',
  -- Thumbnail URL for app list views (≤ 400px wide).

  image_license         VARCHAR(60)     NOT NULL DEFAULT 'CC',
  -- SPDX license identifier or short string: 'CC BY-SA 4.0', 'CC0', 'PEXELS', etc.

  image_source          VARCHAR(30)     NOT NULL DEFAULT 'scraped',
  -- Origin: 'perenual' | 'wikipedia' | 'wikimedia' | 'unsplash' | 'manual' | 'scraped'


  -- ── H. ML / SYSTEM FIELDS ───────────────────────────────────────────────

  ml_weight             NUMERIC(5,3)    NOT NULL DEFAULT 1.000,
  -- Per-species multiplier applied to the final recommendation score.
  -- Default 1.0 = neutral. Tuned after ML training on telemetry data.
  -- Values > 1.0 boost species; < 1.0 demote.
  -- Updated by: lib/ml/exportTelemetryPipeline.ts after each training run.
  CONSTRAINT chk_ml_weight CHECK (ml_weight BETWEEN 0.001 AND 5.0),

  active                BOOLEAN         NOT NULL DEFAULT TRUE,
  -- FALSE → species hidden from all recommendation outputs and app catalog.
  -- Set FALSE instead of deleting to preserve historical telemetry integrity.

  data_confidence       NUMERIC(3,2)    NOT NULL DEFAULT 0.5,
  -- Provenance quality score (0.0–1.0).
  -- 0.1 = seed-only (no external source corroboration)
  -- 0.5 = seed + GBIF + Wikipedia confirmed
  -- 0.8 = seed + Perenual + GBIF + Wikipedia all confirmed
  -- 1.0 = all sources + manual expert review
  CONSTRAINT chk_confidence CHECK (data_confidence BETWEEN 0.0 AND 1.0),

  created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_sc_category        ON species_catalog(category);
CREATE INDEX idx_sc_active          ON species_catalog(active);
CREATE INDEX idx_sc_family          ON species_catalog(family);
CREATE INDEX idx_sc_heat_tol        ON species_catalog(heat_tolerant);
CREATE INDEX idx_sc_drought_tol     ON species_catalog(drought_tolerant);
CREATE INDEX idx_sc_pet_safe        ON species_catalog(pet_safe);
CREATE INDEX idx_sc_water_demand    ON species_catalog(water_demand);
CREATE INDEX idx_sc_sunlight_pref   ON species_catalog(sunlight_preference);
CREATE INDEX idx_sc_cooling         ON species_catalog(cooling_contribution DESC);
CREATE INDEX idx_sc_container       ON species_catalog(container_suitability);

-- ── Auto-update updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_species_catalog_updated
  BEFORE UPDATE ON species_catalog
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();


-- ============================================================================
-- SECTION 3 — SPECIES DATA  (51 entries)
-- ============================================================================
-- Sources per row:
--   seed      = HeatWise curated seed (prisma/data/species_catalog_seed.mjs)
--   gbif      = GBIF Backbone Taxonomy API (api.gbif.org)
--   wikipedia = Wikipedia REST API summary (en.wikipedia.org)
--   perenual  = Perenual Plant API (perenual.com) — requires API key
-- ============================================================================

INSERT INTO species_catalog (
  code, display_name, scientific_name,
  family, genus, kingdom,
  category, growth_habit, cycle,
  native_range_notes, invasive_risk,
  hardiness_zone_min, hardiness_zone_max, max_height_cm,
  edible, flowering, pet_safe,
  drought_tolerant, heat_tolerant, low_maintenance,
  min_sun_hours, max_sun_hours,
  drought_tolerance, climate_suitability,
  sunlight_preference, water_demand,
  maintenance_need, root_aggressiveness,
  pollinator_value, child_pet_safety,
  native_support, container_suitability,
  cooling_contribution, privacy_contribution,
  tags_json, notes,
  image_url, image_thumbnail, image_license, image_source,
  ml_weight, active, data_confidence
) VALUES
  (
    'tulsi_holy',                          -- code
    'Holy basil (Tulsi)',             -- display_name
    'Ocimum tenuiflorum',          -- scientific_name
    'Lamiaceae',                   -- family
    'Ocimum',                    -- genus
    'Plantae',                            -- kingdom
    'HERB',                 -- category
    'HERB',             -- growth_habit
    'Perennial',     -- cycle
    'Species of flowering plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    10,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    60.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    4.0,          -- min_sun_hours
    10.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|SUBTROPICAL',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.5,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    1.3, -- cooling_contribution
    0.8, -- privacy_contribution
    '["native_adapted","aromatic","pollinator"]',                -- tags_json
    'India staple; handles heat; pinch flowers for leaf production.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Tulsi_or_Tulasi_Holy_basil.jpg/330px-Tulsi_or_Tulasi_Holy_basil.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Tulsi_or_Tulasi_Holy_basil.jpg/330px-Tulsi_or_Tulasi_Holy_basil.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'basil_sweet',                          -- code
    'Sweet basil',             -- display_name
    'Ocimum basilicum',          -- scientific_name
    'Lamiaceae',                   -- family
    'Ocimum',                    -- genus
    'Plantae',                            -- kingdom
    'HERB',                 -- category
    'HERB',             -- growth_habit
    'Perennial',     -- cycle
    'Culinary herb',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    11,                    -- hardiness_zone_max
    50.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    4.0,          -- min_sun_hours
    8.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|SUBTROPICAL|TEMPERATE',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    1.3, -- cooling_contribution
    0.8, -- privacy_contribution
    '["container","monsoon_ok"]',                -- tags_json
    'Bolts in extreme heat—afternoon shade helps; water consistently.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Ocimum_basilicum_8zz.jpg/330px-Ocimum_basilicum_8zz.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Ocimum_basilicum_8zz.jpg/330px-Ocimum_basilicum_8zz.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'mint',                          -- code
    'Mint',             -- display_name
    'Mentha spp.',          -- scientific_name
    '',                   -- family
    '',                    -- genus
    'Plantae',                            -- kingdom
    'HERB',                 -- category
    'HERB',             -- growth_habit
    'Perennial',     -- cycle
    '',       -- native_range_notes
    'LOW',   -- invasive_risk
    3,                    -- hardiness_zone_min
    11,                    -- hardiness_zone_max
    60.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    3.0,          -- min_sun_hours
    6.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    1.3, -- cooling_contribution
    0.8, -- privacy_contribution
    '["container","moist_soil"]',                -- tags_json
    'Use deep pot; invasive roots—isolate. Part sun on hot roofs.',                    -- notes
    '',                -- image_url
    '',          -- image_thumbnail
    'CC',    -- image_license
    'scraped', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.1            -- data_confidence
  ),
  (
    'coriander',                          -- code
    'Coriander (Cilantro)',             -- display_name
    'Coriandrum sativum',          -- scientific_name
    'Apiaceae',                   -- family
    'Coriandrum',                    -- genus
    'Plantae',                            -- kingdom
    'HERB',                 -- category
    'HERB',             -- growth_habit
    'Perennial',     -- cycle
    'Annual herb',       -- native_range_notes
    'LOW',   -- invasive_risk
    2,                    -- hardiness_zone_min
    11,                    -- hardiness_zone_max
    50.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    FALSE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    3.0,          -- min_sun_hours
    5.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    1.3, -- cooling_contribution
    0.8, -- privacy_contribution
    '["quick_crop","shade_afternoon"]',                -- tags_json
    'Sow in cooler windows; bolt risk in peak summer—succession plant.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Coriandrum_sativum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-193.jpg/330px-Coriandrum_sativum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-193.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Coriandrum_sativum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-193.jpg/330px-Coriandrum_sativum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-193.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'curry_leaf',                          -- code
    'Curry leaf tree (Kadi patta)',             -- display_name
    'Murraya koenigii',          -- scientific_name
    'Rutaceae',                   -- family
    'Murraya',                    -- genus
    'Plantae',                            -- kingdom
    'HERB',                 -- category
    'HERB',             -- growth_habit
    'Perennial',     -- cycle
    'Species of flowering plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    400.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    6.0,          -- min_sun_hours
    10.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|MONSOON_HEAVY|SUBTROPICAL',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    1.5,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    1.3, -- cooling_contribution
    0.8, -- privacy_contribution
    '["perennial_pot","wind_ok"]',                -- tags_json
    'Large container; protect roots from waterlogging in monsoon.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Curry_Trees.jpg/330px-Curry_Trees.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Curry_Trees.jpg/330px-Curry_Trees.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'lemongrass',                          -- code
    'Lemongrass',             -- display_name
    'Cymbopogon citratus',          -- scientific_name
    'Poaceae',                   -- family
    'Cymbopogon',                    -- genus
    'Plantae',                            -- kingdom
    'HERB',                 -- category
    'HERB',             -- growth_habit
    'Perennial',     -- cycle
    'Species of plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    180.0,                      -- max_height_cm
    TRUE,                     -- edible
    FALSE,                  -- flowering
    TRUE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    6.0,          -- min_sun_hours
    10.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|MONSOON_HEAVY',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    1.3, -- cooling_contribution
    0.8, -- privacy_contribution
    '["container","privacy_screen"]',                -- tags_json
    'Excellent heat performer; divide clumps yearly in pots.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gardenology.org-IMG_2892_rbgs11jan.jpg/330px-Gardenology.org-IMG_2892_rbgs11jan.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gardenology.org-IMG_2892_rbgs11jan.jpg/330px-Gardenology.org-IMG_2892_rbgs11jan.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'cherry_tomato',                          -- code
    'Cherry tomato',             -- display_name
    'Solanum lycopersicum',          -- scientific_name
    'Solanaceae',                   -- family
    'Solanum',                    -- genus
    'Plantae',                            -- kingdom
    'VEGETABLE',                 -- category
    'VEGETABLE',             -- growth_habit
    'Perennial',     -- cycle
    'Edible berry',       -- native_range_notes
    'LOW',   -- invasive_risk
    3,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    150.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    FALSE,            -- low_maintenance
    6.0,          -- min_sun_hours
    10.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    1.5,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'LOW',  -- native_support
    'EXCELLENT', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["vegetable","staking"]',                -- tags_json
    'Deep pot + mulch; blossom drop if nights stay too warm—try heat-set types.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Tomato_je.jpg/330px-Tomato_je.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Tomato_je.jpg/330px-Tomato_je.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'chilli',                          -- code
    'Chilli pepper',             -- display_name
    'Capsicum annuum',          -- scientific_name
    'Solanaceae',                   -- family
    'Capsicum',                    -- genus
    'Plantae',                            -- kingdom
    'VEGETABLE',                 -- category
    'VEGETABLE',             -- growth_habit
    'Perennial',     -- cycle
    'Species of flowering plant in the nightshade family',       -- native_range_notes
    'LOW',   -- invasive_risk
    8,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    90.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    6.0,          -- min_sun_hours
    10.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TEMPERATE',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    1.5,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["productive","container"]',                -- tags_json
    'Very rooftop-friendly in India; watch thrips in dry season.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Capsicum_annuum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-027.jpg/330px-Capsicum_annuum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-027.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Capsicum_annuum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-027.jpg/330px-Capsicum_annuum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-027.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'malabar_spinach',                          -- code
    'Malabar spinach',             -- display_name
    'Basella alba',          -- scientific_name
    'Basellaceae',                   -- family
    'Basella',                    -- genus
    'Plantae',                            -- kingdom
    'VEGETABLE',                 -- category
    'VEGETABLE',             -- growth_habit
    'Perennial',     -- cycle
    'Species of edible plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    300.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    4.0,          -- min_sun_hours
    8.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|MONSOON_HEAVY',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["climber","monsoon_ok"]',                -- tags_json
    'Vining leafy green for hot weather—better than true spinach in heat.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Basella_alba-2.JPG/330px-Basella_alba-2.JPG',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Basella_alba-2.JPG/330px-Basella_alba-2.JPG',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'aloe_vera',                          -- code
    'Aloe vera',             -- display_name
    'Aloe barbadensis miller',          -- scientific_name
    '',                   -- family
    '',                    -- genus
    'Plantae',                            -- kingdom
    'SUCCULENT',                 -- category
    'SUCCULENT',             -- growth_habit
    'Perennial',     -- cycle
    '',       -- native_range_notes
    'LOW',   -- invasive_risk
    8,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    80.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    4.0,          -- min_sun_hours
    10.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    0.9, -- cooling_contribution
    0.8, -- privacy_contribution
    '["succulent","medicinal_lookalike_caution"]',                -- tags_json
    'Roof workhorse; avoid overwatering in humid monsoon.',                    -- notes
    '',                -- image_url
    '',          -- image_thumbnail
    'CC',    -- image_license
    'scraped', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.1            -- data_confidence
  ),
  (
    'jade_plant',                          -- code
    'Jade plant',             -- display_name
    'Crassula ovata',          -- scientific_name
    'Crassulaceae',                   -- family
    'Crassula',                    -- genus
    'Plantae',                            -- kingdom
    'SUCCULENT',                 -- category
    'SUCCULENT',             -- growth_habit
    'Perennial',     -- cycle
    'Species of succulent',       -- native_range_notes
    'LOW',   -- invasive_risk
    10,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    250.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    4.0,          -- min_sun_hours
    8.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    0.9, -- cooling_contribution
    0.8, -- privacy_contribution
    '["succulent","wind_ok"]',                -- tags_json
    'Slow; afternoon shade on very hot roofs reduces leaf scorch.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Crassula_ovata_700.jpg/330px-Crassula_ovata_700.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Crassula_ovata_700.jpg/330px-Crassula_ovata_700.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'sedum',                          -- code
    'Sedum (stonecrop)',             -- display_name
    'Sedum spp.',          -- scientific_name
    '',                   -- family
    '',                    -- genus
    'Plantae',                            -- kingdom
    'SUCCULENT',                 -- category
    'SUCCULENT',             -- growth_habit
    'Perennial',     -- cycle
    '',       -- native_range_notes
    'LOW',   -- invasive_risk
    3,                    -- hardiness_zone_min
    11,                    -- hardiness_zone_max
    45.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    6.0,          -- min_sun_hours
    12.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    0.9, -- cooling_contribution
    0.8, -- privacy_contribution
    '["green_roof","drought"]',                -- tags_json
    'Green roof / shallow tray candidate; sharp drainage.',                    -- notes
    '',                -- image_url
    '',          -- image_thumbnail
    'CC',    -- image_license
    'scraped', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.1            -- data_confidence
  ),
  (
    'prickly_pear',                          -- code
    'Prickly pear cactus',             -- display_name
    'Opuntia spp.',          -- scientific_name
    '',                   -- family
    '',                    -- genus
    'Plantae',                            -- kingdom
    'SUCCULENT',                 -- category
    'SUCCULENT',             -- growth_habit
    'Perennial',     -- cycle
    '',       -- native_range_notes
    'LOW',   -- invasive_risk
    4,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    300.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    8.0,          -- min_sun_hours
    12.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    0.9, -- cooling_contribution
    0.8, -- privacy_contribution
    '["cactus","full_sun"]',                -- tags_json
    'Extreme heat/drought; pad handling and spines—pets/kids.',                    -- notes
    '',                -- image_url
    '',          -- image_thumbnail
    'CC',    -- image_license
    'scraped', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.1            -- data_confidence
  ),
  (
    'bougainvillea',                          -- code
    'Bougainvillea',             -- display_name
    'Bougainvillea spp.',          -- scientific_name
    '',                   -- family
    '',                    -- genus
    'Plantae',                            -- kingdom
    'ORNAMENTAL',                 -- category
    'ORNAMENTAL',             -- growth_habit
    'Perennial',     -- cycle
    '',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    1200.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    8.0,          -- min_sun_hours
    12.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["climber","color"]',                -- tags_json
    'Classic Indian terrace; large pot + trellis; sharp thorns.',                    -- notes
    '',                -- image_url
    '',          -- image_thumbnail
    'CC',    -- image_license
    'scraped', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.1            -- data_confidence
  ),
  (
    'hibiscus',                          -- code
    'Chinese hibiscus',             -- display_name
    'Hibiscus rosa-sinensis',          -- scientific_name
    'Malvaceae',                   -- family
    'Hibiscus',                    -- genus
    'Plantae',                            -- kingdom
    'ORNAMENTAL',                 -- category
    'ORNAMENTAL',             -- growth_habit
    'Perennial',     -- cycle
    'Hybrid species of flowering plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    490.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    FALSE,            -- low_maintenance
    6.0,          -- min_sun_hours
    10.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["flowering_shrub","container"]',                -- tags_json
    'Needs water in heat; watch for aphids; great tropical roof vibe.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Hibiscus_Brilliant.jpg/330px-Hibiscus_Brilliant.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Hibiscus_Brilliant.jpg/330px-Hibiscus_Brilliant.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'marigold',                          -- code
    'Marigold (Genda)',             -- display_name
    'Tagetes spp.',          -- scientific_name
    '',                   -- family
    '',                    -- genus
    'Plantae',                            -- kingdom
    'ORNAMENTAL',                 -- category
    'ORNAMENTAL',             -- growth_habit
    'Perennial',     -- cycle
    '',       -- native_range_notes
    'LOW',   -- invasive_risk
    2,                    -- hardiness_zone_min
    11,                    -- hardiness_zone_max
    90.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    6.0,          -- min_sun_hours
    10.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["annual","pest_companion"]',                -- tags_json
    'Companion plant; tolerates poor soil; easy from seed.',                    -- notes
    '',                -- image_url
    '',          -- image_thumbnail
    'CC',    -- image_license
    'scraped', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.1            -- data_confidence
  ),
  (
    'portulaca',                          -- code
    'Portulaca (moss rose)',             -- display_name
    'Portulaca grandiflora',          -- scientific_name
    'Portulacaceae',                   -- family
    'Portulaca',                    -- genus
    'Plantae',                            -- kingdom
    'ORNAMENTAL',                 -- category
    'ORNAMENTAL',             -- growth_habit
    'Perennial',     -- cycle
    'Rose-like flowering plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    2,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    30.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    6.0,          -- min_sun_hours
    12.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["annual","shallow_root"]',                -- tags_json
    'Trailing color for shallow planters; loves sun and heat.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/PortulacaGrandiflora.jpg/330px-PortulacaGrandiflora.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/PortulacaGrandiflora.jpg/330px-PortulacaGrandiflora.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'vinca',                          -- code
    'Periwinkle (Vinca)',             -- display_name
    'Catharanthus roseus',          -- scientific_name
    'Apocynaceae',                   -- family
    'Catharanthus',                    -- genus
    'Plantae',                            -- kingdom
    'ORNAMENTAL',                 -- category
    'ORNAMENTAL',             -- growth_habit
    'Perennial',     -- cycle
    'Species of flowering plant in the family Apocynaceae',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    60.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    4.0,          -- min_sun_hours
    10.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["annual","container"]',                -- tags_json
    'Heat-tolerant color; toxic if ingested—keep from pets.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Catharanthus_roseus_%28Pink_Madagascar_Periwinkle%29.jpg/330px-Catharanthus_roseus_%28Pink_Madagascar_Periwinkle%29.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Catharanthus_roseus_%28Pink_Madagascar_Periwinkle%29.jpg/330px-Catharanthus_roseus_%28Pink_Madagascar_Periwinkle%29.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'zinnia',                          -- code
    'Zinnia',             -- display_name
    'Zinnia elegans',          -- scientific_name
    'Asteraceae',                   -- family
    'Zinnia',                    -- genus
    'Plantae',                            -- kingdom
    'ORNAMENTAL',                 -- category
    'ORNAMENTAL',             -- growth_habit
    'Perennial',     -- cycle
    'Species of flowering plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    2,                    -- hardiness_zone_min
    11,                    -- hardiness_zone_max
    90.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    6.0,          -- min_sun_hours
    12.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'SUBTROPICAL',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["annual","pollinator"]',                -- tags_json
    'Cut-and-come-again; excellent for hot balconies.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Zinnienbl%C3%BCte_Zinnia_elegans_stack15_20190722-RM-7222254.jpg/330px-Zinnienbl%C3%BCte_Zinnia_elegans_stack15_20190722-RM-7222254.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Zinnienbl%C3%BCte_Zinnia_elegans_stack15_20190722-RM-7222254.jpg/330px-Zinnienbl%C3%BCte_Zinnia_elegans_stack15_20190722-RM-7222254.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'pothos',                          -- code
    'Money plant (Pothos)',             -- display_name
    'Epipremnum aureum',          -- scientific_name
    'Araceae',                   -- family
    'Epipremnum',                    -- genus
    'Plantae',                            -- kingdom
    'FOLIAGE',                 -- category
    'FOLIAGE',             -- growth_habit
    'Perennial',     -- cycle
    'Species of plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    10,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    1800.0,                      -- max_height_cm
    FALSE,                     -- edible
    FALSE,                  -- flowering
    FALSE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    2.0,          -- min_sun_hours
    6.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|MONSOON_HEAVY|SUBTROPICAL|TEMPERATE',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'EXCELLENT', -- container_suitability
    2.4, -- cooling_contribution
    1.6, -- privacy_contribution
    '["shade_balcony","hanging"]',                -- tags_json
    'Bright indirect on hot balconies; avoid direct noon sun.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Money_Plant_%28Epipremnum_aureum%29_4.jpg/330px-Money_Plant_%28Epipremnum_aureum%29_4.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Money_Plant_%28Epipremnum_aureum%29_4.jpg/330px-Money_Plant_%28Epipremnum_aureum%29_4.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'snake_plant',                          -- code
    'Snake plant',             -- display_name
    'Dracaena trifasciata',          -- scientific_name
    'Asparagaceae',                   -- family
    'Dracaena',                    -- genus
    'Plantae',                            -- kingdom
    'FOLIAGE',                 -- category
    'FOLIAGE',             -- growth_habit
    'Perennial',     -- cycle
    'Species of flowering plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    130.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    2.0,          -- min_sun_hours
    8.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    2.4, -- cooling_contribution
    1.6, -- privacy_contribution
    '["low_light_roof_corner","wind_ok"]',                -- tags_json
    'Tolerates AC-adjacent semi-shade corners; rot if overwatered.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Snake_Plant_%28Sansevieria_trifasciata_%27Laurentii%27%29.jpg/330px-Snake_Plant_%28Sansevieria_trifasciata_%27Laurentii%27%29.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Snake_Plant_%28Sansevieria_trifasciata_%27Laurentii%27%29.jpg/330px-Snake_Plant_%28Sansevieria_trifasciata_%27Laurentii%27%29.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'spider_plant',                          -- code
    'Spider plant',             -- display_name
    'Chlorophytum comosum',          -- scientific_name
    'Asparagaceae',                   -- family
    'Chlorophytum',                    -- genus
    'Plantae',                            -- kingdom
    'FOLIAGE',                 -- category
    'FOLIAGE',             -- growth_habit
    'Perennial',     -- cycle
    'Species of flowering plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    8,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    60.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    3.0,          -- min_sun_hours
    6.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|MONSOON_HEAVY|SUBTROPICAL',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    2.4, -- cooling_contribution
    1.6, -- privacy_contribution
    '["hanging","shade_balcony"]',                -- tags_json
    'Part shade on terraces; brown tips if scorched or salty water.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Hierbabuena_0611_Revised.jpg/330px-Hierbabuena_0611_Revised.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Hierbabuena_0611_Revised.jpg/330px-Hierbabuena_0611_Revised.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'geranium_pelargonium',                          -- code
    'Scented geranium',             -- display_name
    'Pelargonium spp.',          -- scientific_name
    '',                   -- family
    '',                    -- genus
    'Plantae',                            -- kingdom
    'ORNAMENTAL',                 -- category
    'ORNAMENTAL',             -- growth_habit
    'Perennial',     -- cycle
    '',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    60.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    6.0,          -- min_sun_hours
    10.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["container","aromatic"]',                -- tags_json
    'Good in pots; some scents deter mosquitoes (mild effect).',                    -- notes
    '',                -- image_url
    '',          -- image_thumbnail
    'CC',    -- image_license
    'scraped', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.1            -- data_confidence
  ),
  (
    'plumeria',                          -- code
    'Plumeria (Frangipani)',             -- display_name
    'Plumeria spp.',          -- scientific_name
    '',                   -- family
    '',                    -- genus
    'Plantae',                            -- kingdom
    'ORNAMENTAL',                 -- category
    'ORNAMENTAL',             -- growth_habit
    'Perennial',     -- cycle
    '',       -- native_range_notes
    'LOW',   -- invasive_risk
    10,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    800.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    8.0,          -- min_sun_hours
    12.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["tropical","fragrant"]',                -- tags_json
    'Large container; deciduous; protect from waterlogging.',                    -- notes
    '',                -- image_url
    '',          -- image_thumbnail
    'CC',    -- image_license
    'scraped', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.1            -- data_confidence
  ),
  (
    'okra',                          -- code
    'Okra (Bhindi)',             -- display_name
    'Abelmoschus esculentus',          -- scientific_name
    'Malvaceae',                   -- family
    'Abelmoschus',                    -- genus
    'Plantae',                            -- kingdom
    'VEGETABLE',                 -- category
    'VEGETABLE',             -- growth_habit
    'Perennial',     -- cycle
    'Species of edible plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    8,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    200.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    FALSE,            -- low_maintenance
    6.0,          -- min_sun_hours
    10.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|SUBTROPICAL|TEMPERATE',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["kitchen_garden","monsoon_ok"]',                -- tags_json
    'Heat-loving pod crop; deep pot; harvest young pods regularly.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Hong_Kong_Okra_Aug_25_2012.JPG/330px-Hong_Kong_Okra_Aug_25_2012.JPG',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Hong_Kong_Okra_Aug_25_2012.JPG/330px-Hong_Kong_Okra_Aug_25_2012.JPG',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'spinach_indian',                          -- code
    'Indian spinach (Palak)',             -- display_name
    'Spinacia oleracea',          -- scientific_name
    'Amaranthaceae',                   -- family
    'Spinacia',                    -- genus
    'Plantae',                            -- kingdom
    'HERB',                 -- category
    'HERB',             -- growth_habit
    'Perennial',     -- cycle
    'Species of flowering plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    3,                    -- hardiness_zone_min
    11,                    -- hardiness_zone_max
    30.0,                      -- max_height_cm
    TRUE,                     -- edible
    FALSE,                  -- flowering
    TRUE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    FALSE,              -- heat_tolerant
    FALSE,            -- low_maintenance
    3.0,          -- min_sun_hours
    6.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    1.3, -- cooling_contribution
    0.8, -- privacy_contribution
    '["quick_crop","shade_afternoon"]',                -- tags_json
    'Cool-season windows in hot climates; afternoon shade; succession plant.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Spinacia_oleracea_Spinazie_bloeiend.jpg/330px-Spinacia_oleracea_Spinazie_bloeiend.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Spinacia_oleracea_Spinazie_bloeiend.jpg/330px-Spinacia_oleracea_Spinazie_bloeiend.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'eggplant_mini',                          -- code
    'Mini brinjal (eggplant)',             -- display_name
    'Solanum melongena',          -- scientific_name
    'Solanaceae',                   -- family
    'Solanum',                    -- genus
    'Plantae',                            -- kingdom
    'VEGETABLE',                 -- category
    'VEGETABLE',             -- growth_habit
    'Perennial',     -- cycle
    'Plant species',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    100.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    FALSE,            -- low_maintenance
    6.0,          -- min_sun_hours
    10.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["container","nightshade"]',                -- tags_json
    'Nightshade; even moisture; large pot for stability in wind.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Solanum_melongena_24_08_2012_%281%29.JPG/330px-Solanum_melongena_24_08_2012_%281%29.JPG',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Solanum_melongena_24_08_2012_%281%29.JPG/330px-Solanum_melongena_24_08_2012_%281%29.JPG',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'luffa',                          -- code
    'Ridge gourd (Turai)',             -- display_name
    'Luffa acutangula',          -- scientific_name
    'Cucurbitaceae',                   -- family
    'Luffa',                    -- genus
    'Plantae',                            -- kingdom
    'VEGETABLE',                 -- category
    'VEGETABLE',             -- growth_habit
    'Perennial',     -- cycle
    'Species of flowering plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    300.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    FALSE,            -- low_maintenance
    6.0,          -- min_sun_hours
    10.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|TEMPERATE',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    1.5,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["vine","monsoon_ok"]',                -- tags_json
    'Strong trellis; heavy feed and water during fruiting.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Luffa_acutangula_Chinese_okra.jpg/330px-Luffa_acutangula_Chinese_okra.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Luffa_acutangula_Chinese_okra.jpg/330px-Luffa_acutangula_Chinese_okra.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'peace_lily',                          -- code
    'Peace lily',             -- display_name
    'Spathiphyllum spp.',          -- scientific_name
    '',                   -- family
    '',                    -- genus
    'Plantae',                            -- kingdom
    'FOLIAGE',                 -- category
    'FOLIAGE',             -- growth_habit
    'Perennial',     -- cycle
    '',       -- native_range_notes
    'LOW',   -- invasive_risk
    11,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    90.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    FALSE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    2.0,          -- min_sun_hours
    5.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    2.4, -- cooling_contribution
    1.6, -- privacy_contribution
    '["low_light","shade_balcony"]',                -- tags_json
    'Low light tolerant; keep evenly moist; leaf burn if harsh sun.',                    -- notes
    '',                -- image_url
    '',          -- image_thumbnail
    'CC',    -- image_license
    'scraped', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.1            -- data_confidence
  ),
  (
    'jasmine_mogra',                          -- code
    'Mogra jasmine',             -- display_name
    'Jasminum sambac',          -- scientific_name
    'Oleaceae',                   -- family
    'Jasminum',                    -- genus
    'Plantae',                            -- kingdom
    'ORNAMENTAL',                 -- category
    'ORNAMENTAL',             -- growth_habit
    'Perennial',     -- cycle
    'Species of jasmine',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    300.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    FALSE,            -- low_maintenance
    4.0,          -- min_sun_hours
    8.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|MONSOON_HEAVY|SUBTROPICAL',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["fragrant","container"]',                -- tags_json
    'Intensely fragrant; afternoon shade on hottest roofs; regular water.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Arabian_jasmin%2C_Tunisia_2010.jpg/330px-Arabian_jasmin%2C_Tunisia_2010.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Arabian_jasmin%2C_Tunisia_2010.jpg/330px-Arabian_jasmin%2C_Tunisia_2010.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'vetiver',                          -- code
    'Vetiver grass',             -- display_name
    'Chrysopogon zizanioides',          -- scientific_name
    'Poaceae',                   -- family
    'Chrysopogon',                    -- genus
    'Plantae',                            -- kingdom
    'GRASS',                 -- category
    'GRASS',             -- growth_habit
    'Perennial',     -- cycle
    'Species of plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    8,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    200.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    6.0,          -- min_sun_hours
    12.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    2.5, -- cooling_contribution
    2.5, -- privacy_contribution
    '["cooling","erosion_help"]',                -- tags_json
    'Deep roots; high transpiration when established; contain spread in small pots.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Vetiver_grass.jpg/330px-Vetiver_grass.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Vetiver_grass.jpg/330px-Vetiver_grass.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'sweet_potato_vine',                          -- code
    'Sweet potato vine',             -- display_name
    'Ipomoea batatas',          -- scientific_name
    'Convolvulaceae',                   -- family
    'Ipomoea',                    -- genus
    'Plantae',                            -- kingdom
    'CREEPER',                 -- category
    'ORNAMENTAL',             -- growth_habit
    'Perennial',     -- cycle
    'Species of edible plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    400.0,                      -- max_height_cm
    TRUE,                     -- edible
    FALSE,                  -- flowering
    TRUE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    4.0,          -- min_sun_hours
    10.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    1.5,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'LOW',  -- native_support
    'EXCELLENT', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["ground_cover","container"]',                -- tags_json
    'Fast-growing ground cover; colourful foliage; edible tubers if grown long enough.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Ipomoea_batatas_006.JPG/330px-Ipomoea_batatas_006.JPG',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Ipomoea_batatas_006.JPG/330px-Ipomoea_batatas_006.JPG',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'dracaena_marginata',                          -- code
    'Dragon tree (Dracaena)',             -- display_name
    'Dracaena marginata',          -- scientific_name
    'Asparagaceae',                   -- family
    'Dracaena',                    -- genus
    'Plantae',                            -- kingdom
    'FOLIAGE',                 -- category
    'FOLIAGE',             -- growth_habit
    'Perennial',     -- cycle
    'Species of flowering plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    10,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    500.0,                      -- max_height_cm
    FALSE,                     -- edible
    FALSE,                  -- flowering
    FALSE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    3.0,          -- min_sun_hours
    8.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|MONSOON_HEAVY',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    2.4, -- cooling_contribution
    1.6, -- privacy_contribution
    '["shade_balcony","accent"]',                -- tags_json
    'Architectural accent; tolerates partial shade on shaded balconies; low water.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Dracaena_reflexa.JPG/330px-Dracaena_reflexa.JPG',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Dracaena_reflexa.JPG/330px-Dracaena_reflexa.JPG',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'coleus',                          -- code
    'Coleus',             -- display_name
    'Plectranthus scutellarioides',          -- scientific_name
    'Lamiaceae',                   -- family
    'Coleus',                    -- genus
    'Plantae',                            -- kingdom
    'FOLIAGE',                 -- category
    'FOLIAGE',             -- growth_habit
    'Perennial',     -- cycle
    'Species of flowering plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    10,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    90.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    2.0,          -- min_sun_hours
    6.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|SUBTROPICAL',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    2.4, -- cooling_contribution
    1.6, -- privacy_contribution
    '["shade_balcony","colorful"]',                -- tags_json
    'Vivid foliage for shaded balconies; pinch flowers to keep leaf colour; keep moist.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Plectranthus_scutellarioides_-_El_Yunque_nat_park_PR_IMG_2120.JPG/330px-Plectranthus_scutellarioides_-_El_Yunque_nat_park_PR_IMG_2120.JPG',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Plectranthus_scutellarioides_-_El_Yunque_nat_park_PR_IMG_2120.JPG/330px-Plectranthus_scutellarioides_-_El_Yunque_nat_park_PR_IMG_2120.JPG',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'ficus_pumila',                          -- code
    'Creeping fig',             -- display_name
    'Ficus pumila',          -- scientific_name
    'Moraceae',                   -- family
    'Ficus',                    -- genus
    'Plantae',                            -- kingdom
    'CLIMBER',                 -- category
    'CLIMBER',             -- growth_habit
    'Perennial',     -- cycle
    'Species of climbing fig',       -- native_range_notes
    'LOW',   -- invasive_risk
    8,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    400.0,                      -- max_height_cm
    FALSE,                     -- edible
    FALSE,                  -- flowering
    FALSE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    2.0,          -- min_sun_hours
    6.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    3.0, -- cooling_contribution
    2.8, -- privacy_contribution
    '["wall_climber","shade_balcony"]',                -- tags_json
    'Self-clinging wall climber; good shade cover on balcony walls; keep evenly moist.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Ficus_pumila_%28Leafs%29.jpg/330px-Ficus_pumila_%28Leafs%29.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Ficus_pumila_%28Leafs%29.jpg/330px-Ficus_pumila_%28Leafs%29.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'adenium',                          -- code
    'Desert rose (Adenium)',             -- display_name
    'Adenium obesum',          -- scientific_name
    'Apocynaceae',                   -- family
    'Adenium',                    -- genus
    'Plantae',                            -- kingdom
    'SUCCULENT',                 -- category
    'SUCCULENT',             -- growth_habit
    'Perennial',     -- cycle
    'Species of plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    10,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    300.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    6.0,          -- min_sun_hours
    12.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|SUBTROPICAL|TEMPERATE',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    0.9, -- cooling_contribution
    0.8, -- privacy_contribution
    '["drought","full_sun","bonsai_style"]',                -- tags_json
    'Stunning red/pink blooms; xeric champion; reduce water in monsoon to prevent rot.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Adenium_Obesum_Flower_Side_Macro_Mar22_D72_23052-58_ZS_P.jpg/330px-Adenium_Obesum_Flower_Side_Macro_Mar22_D72_23052-58_ZS_P.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Adenium_Obesum_Flower_Side_Macro_Mar22_D72_23052-58_ZS_P.jpg/330px-Adenium_Obesum_Flower_Side_Macro_Mar22_D72_23052-58_ZS_P.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'bamboo_dwarf',                          -- code
    'Dwarf bamboo',             -- display_name
    'Pleioblastus spp.',          -- scientific_name
    '',                   -- family
    '',                    -- genus
    'Plantae',                            -- kingdom
    'GRASS',                 -- category
    'GRASS',             -- growth_habit
    'Perennial',     -- cycle
    '',       -- native_range_notes
    'LOW',   -- invasive_risk
    5,                    -- hardiness_zone_min
    11,                    -- hardiness_zone_max
    150.0,                      -- max_height_cm
    FALSE,                     -- edible
    FALSE,                  -- flowering
    TRUE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    FALSE,            -- low_maintenance
    4.0,          -- min_sun_hours
    10.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    2.5, -- cooling_contribution
    2.5, -- privacy_contribution
    '["privacy_screen","container_heavy"]',                -- tags_json
    'Privacy screen in large containers; invasive roots — use strong pot; regular water needed.',                    -- notes
    '',                -- image_url
    '',          -- image_thumbnail
    'CC',    -- image_license
    'scraped', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.1            -- data_confidence
  ),
  (
    'areca_palm_dwarf',                          -- code
    'Areca palm (dwarf)',             -- display_name
    'Dypsis lutescens',          -- scientific_name
    'Arecaceae',                   -- family
    'Dypsis',                    -- genus
    'Plantae',                            -- kingdom
    'FOLIAGE',                 -- category
    'FOLIAGE',             -- growth_habit
    'Perennial',     -- cycle
    'Species of plant from Madagascar',       -- native_range_notes
    'LOW',   -- invasive_risk
    10,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    600.0,                      -- max_height_cm
    FALSE,                     -- edible
    FALSE,                  -- flowering
    TRUE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    FALSE,            -- low_maintenance
    4.0,          -- min_sun_hours
    8.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'SUBTROPICAL',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    1.5,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    2.4, -- cooling_contribution
    1.6, -- privacy_contribution
    '["tropical","container"]',                -- tags_json
    'Tropical feel; needs consistent moisture and feeding; avoid harsh direct midday sun.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/%E6%95%A3%E5%B0%BE%E8%91%B5Dypsis_lutescens_20210511145013_05.jpg/330px-%E6%95%A3%E5%B0%BE%E8%91%B5Dypsis_lutescens_20210511145013_05.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/%E6%95%A3%E5%B0%BE%E8%91%B5Dypsis_lutescens_20210511145013_05.jpg/330px-%E6%95%A3%E5%B0%BE%E8%91%B5Dypsis_lutescens_20210511145013_05.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'caladium',                          -- code
    'Caladium',             -- display_name
    'Caladium bicolor',          -- scientific_name
    'Araceae',                   -- family
    'Caladium',                    -- genus
    'Plantae',                            -- kingdom
    'FOLIAGE',                 -- category
    'FOLIAGE',             -- growth_habit
    'Perennial',     -- cycle
    'Species of flowering plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    90.0,                      -- max_height_cm
    FALSE,                     -- edible
    FALSE,                  -- flowering
    FALSE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    FALSE,              -- heat_tolerant
    FALSE,            -- low_maintenance
    1.0,          -- min_sun_hours
    4.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'HIGH', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    2.4, -- cooling_contribution
    1.6, -- privacy_contribution
    '["shade_only","seasonal"]',                -- tags_json
    'Show-stopping shade foliage; goes dormant in heat/dry — store tubers; not for water-scarce setups.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Caladium_bicolor_2.jpg/330px-Caladium_bicolor_2.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Caladium_bicolor_2.jpg/330px-Caladium_bicolor_2.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'brahmi',                          -- code
    'Brahmi (Bacopa)',             -- display_name
    'Bacopa monnieri',          -- scientific_name
    'Plantaginaceae',                   -- family
    'Bacopa',                    -- genus
    'Plantae',                            -- kingdom
    'HERB',                 -- category
    'HERB',             -- growth_habit
    'Perennial',     -- cycle
    'Species of aquatic plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    8,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    30.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    3.0,          -- min_sun_hours
    7.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|MONSOON_HEAVY',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    1.3, -- cooling_contribution
    0.8, -- privacy_contribution
    '["medicinal","shallow_tray"]',                -- tags_json
    'Ayurvedic herb; grows in shallow trays with consistent moisture; spreading ground cover.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Starr_010818-0007_Bacopa_monnieri.jpg/330px-Starr_010818-0007_Bacopa_monnieri.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Starr_010818-0007_Bacopa_monnieri.jpg/330px-Starr_010818-0007_Bacopa_monnieri.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'fenugreek',                          -- code
    'Methi / Fenugreek',             -- display_name
    'Trigonella foenum-graecum',          -- scientific_name
    'Fabaceae',                   -- family
    'Trigonella',                    -- genus
    'Plantae',                            -- kingdom
    'HERB',                 -- category
    'HERB',             -- growth_habit
    'Perennial',     -- cycle
    'Species of flowering plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    6,                    -- hardiness_zone_min
    11,                    -- hardiness_zone_max
    60.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    FALSE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    3.0,          -- min_sun_hours
    6.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|MONSOON_HEAVY|HOT_DRY|MEDITERRANEAN',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    1.5,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    1.3, -- cooling_contribution
    0.8, -- privacy_contribution
    '["quick_crop","kitchen_garden"]',                -- tags_json
    'Cool-season crop; bolt in peak summer; rapid 4-week harvest cycle for leaves.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Illustration_Trigonella_foenum-graecum0_clean.jpg/330px-Illustration_Trigonella_foenum-graecum0_clean.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Illustration_Trigonella_foenum-graecum0_clean.jpg/330px-Illustration_Trigonella_foenum-graecum0_clean.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'bitter_gourd',                          -- code
    'Bitter gourd (Karela)',             -- display_name
    'Momordica charantia',          -- scientific_name
    'Cucurbitaceae',                   -- family
    'Momordica',                    -- genus
    'Plantae',                            -- kingdom
    'VEGETABLE',                 -- category
    'VEGETABLE',             -- growth_habit
    'Perennial',     -- cycle
    'Species of plant in the gourd family',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    500.0,                      -- max_height_cm
    TRUE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    FALSE,            -- low_maintenance
    6.0,          -- min_sun_hours
    10.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|SUBTROPICAL',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["vine","kitchen_garden","monsoon_ok"]',                -- tags_json
    'Productive vine for trellis; peak performance in Indian summer heat; harvest young.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Momordica_charantia_Blanco2.357.png/330px-Momordica_charantia_Blanco2.357.png',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Momordica_charantia_Blanco2.357.png/330px-Momordica_charantia_Blanco2.357.png',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'morning_glory',                          -- code
    'Morning glory',             -- display_name
    'Ipomoea purpurea',          -- scientific_name
    'Convolvulaceae',                   -- family
    'Ipomoea',                    -- genus
    'Plantae',                            -- kingdom
    'CLIMBER',                 -- category
    'CLIMBER',             -- growth_habit
    'Perennial',     -- cycle
    'Species of plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    3,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    500.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    6.0,          -- min_sun_hours
    12.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    3.0, -- cooling_contribution
    2.8, -- privacy_contribution
    '["annual","trellis","color"]',                -- tags_json
    'Fast annual climber; large trumpet flowers; self-seeds; very easy from seed on trellis.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Ipomoea_purpurea%2C_2021-08-31%2C_Beechview%2C_05.jpg/330px-Ipomoea_purpurea%2C_2021-08-31%2C_Beechview%2C_05.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Ipomoea_purpurea%2C_2021-08-31%2C_Beechview%2C_05.jpg/330px-Ipomoea_purpurea%2C_2021-08-31%2C_Beechview%2C_05.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'chrysanthemum',                          -- code
    'Chrysanthemum (Guldaudi)',             -- display_name
    'Chrysanthemum morifolium',          -- scientific_name
    'Asteraceae',                   -- family
    'Chrysanthemum',                    -- genus
    'Plantae',                            -- kingdom
    'ORNAMENTAL',                 -- category
    'ORNAMENTAL',             -- growth_habit
    'Perennial',     -- cycle
    'Species of plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    5,                    -- hardiness_zone_min
    11,                    -- hardiness_zone_max
    150.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    FALSE,              -- heat_tolerant
    FALSE,            -- low_maintenance
    5.0,          -- min_sun_hours
    8.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["seasonal","festive"]',                -- tags_json
    'October–December bloomer for Indian rooftops; needs cool nights to flower; pinch in summer.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Chrysanthemum.JPG/330px-Chrysanthemum.JPG',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Chrysanthemum.JPG/330px-Chrysanthemum.JPG',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'crossandra',                          -- code
    'Crossandra (Aboli)',             -- display_name
    'Crossandra infundibuliformis',          -- scientific_name
    'Acanthaceae',                   -- family
    'Crossandra',                    -- genus
    'Plantae',                            -- kingdom
    'ORNAMENTAL',                 -- category
    'ORNAMENTAL',             -- growth_habit
    'Perennial',     -- cycle
    'Species of flowering plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    10,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    90.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    3.0,          -- min_sun_hours
    7.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|MONSOON_HEAVY',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["shade_tolerant","container","color"]',                -- tags_json
    'Long-season orange bloomer; tolerates shade on hot Indian balconies; keep moist.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Crossandra_infundibuliformis_kanakambaram_Madhurawada_Visakhapatnam.JPG/330px-Crossandra_infundibuliformis_kanakambaram_Madhurawada_Visakhapatnam.JPG',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Crossandra_infundibuliformis_kanakambaram_Madhurawada_Visakhapatnam.JPG/330px-Crossandra_infundibuliformis_kanakambaram_Madhurawada_Visakhapatnam.JPG',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'duranta',                          -- code
    'Golden dewdrop (Duranta)',             -- display_name
    'Duranta erecta',          -- scientific_name
    'Verbenaceae',                   -- family
    'Duranta',                    -- genus
    'Plantae',                            -- kingdom
    'SHRUB',                 -- category
    'SHRUB',             -- growth_habit
    'Perennial',     -- cycle
    'Species of flowering plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    600.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    6.0,          -- min_sun_hours
    12.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|SUBTROPICAL',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    2.0, -- cooling_contribution
    1.8, -- privacy_contribution
    '["hedge","pollinator","full_sun"]',                -- tags_json
    'Tough full-sun shrub for terrace hedges; berries toxic; blue flowers attract butterflies.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Duranta_erecta_serres_du_Luxembourg.jpg/330px-Duranta_erecta_serres_du_Luxembourg.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Duranta_erecta_serres_du_Luxembourg.jpg/330px-Duranta_erecta_serres_du_Luxembourg.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'wandering_jew',                          -- code
    'Tradescantia (Wandering jew)',             -- display_name
    'Tradescantia zebrina',          -- scientific_name
    'Commelinaceae',                   -- family
    'Tradescantia',                    -- genus
    'Plantae',                            -- kingdom
    'FOLIAGE',                 -- category
    'FOLIAGE',             -- growth_habit
    'Perennial',     -- cycle
    'Species of flowering plant in the family Commelinaceae',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    30.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    FALSE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    2.0,          -- min_sun_hours
    7.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'SUBTROPICAL',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    1.5,     -- pollinator_value
    'UNSAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    2.4, -- cooling_contribution
    1.6, -- privacy_contribution
    '["hanging","shade_tolerant","colorful"]',                -- tags_json
    'Trailing foliage for hanging baskets or balcony railings; silver-purple leaves; easy from cuttings.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Zebrina_pendula_20060521_2_closer.jpg/330px-Zebrina_pendula_20060521_2_closer.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Zebrina_pendula_20060521_2_closer.jpg/330px-Zebrina_pendula_20060521_2_closer.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'henna',                          -- code
    'Henna (Mehndi)',             -- display_name
    'Lawsonia inermis',          -- scientific_name
    'Lythraceae',                   -- family
    'Lawsonia',                    -- genus
    'Plantae',                            -- kingdom
    'SHRUB',                 -- category
    'SHRUB',             -- growth_habit
    'Perennial',     -- cycle
    'Species of tree',       -- native_range_notes
    'LOW',   -- invasive_risk
    10,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    600.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    6.0,          -- min_sun_hours
    12.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    2.0, -- cooling_contribution
    1.8, -- privacy_contribution
    '["native_adapted","fragrant","hedge"]',                -- tags_json
    'Fragrant white flowers; dense hedge; very heat and drought resistant once established.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Lawsonia_inermis_%283709419835%29.jpg/330px-Lawsonia_inermis_%283709419835%29.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Lawsonia_inermis_%283709419835%29.jpg/330px-Lawsonia_inermis_%283709419835%29.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'lemongrass_dense',                          -- code
    'Dense lemongrass screen',             -- display_name
    'Cymbopogon flexuosus',          -- scientific_name
    'Poaceae',                   -- family
    'Cymbopogon',                    -- genus
    'Plantae',                            -- kingdom
    'GRASS',                 -- category
    'GRASS',             -- growth_habit
    'Perennial',     -- cycle
    'Species of grass',       -- native_range_notes
    'LOW',   -- invasive_risk
    9,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    200.0,                      -- max_height_cm
    TRUE,                     -- edible
    FALSE,                  -- flowering
    TRUE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    6.0,          -- min_sun_hours
    12.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID|MONSOON_HEAVY',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    2.5, -- cooling_contribution
    2.5, -- privacy_contribution
    '["privacy_screen","cooling","wind_ok"]',                -- tags_json
    'East Indian variety; taller and denser than C. citratus; ideal windbreak and privacy screen.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Cymbopogon_flexuosus%2C_Phipps_Conservatory%2C_2015-10-10%2C_01.jpg/330px-Cymbopogon_flexuosus%2C_Phipps_Conservatory%2C_2015-10-10%2C_01.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Cymbopogon_flexuosus%2C_Phipps_Conservatory%2C_2015-10-10%2C_01.jpg/330px-Cymbopogon_flexuosus%2C_Phipps_Conservatory%2C_2015-10-10%2C_01.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  ),
  (
    'neem_dwarf',                          -- code
    'Dwarf neem',             -- display_name
    'Azadirachta indica (dwarf cv.)',          -- scientific_name
    '',                   -- family
    '',                    -- genus
    'Plantae',                            -- kingdom
    'SHRUB',                 -- category
    'SHRUB',             -- growth_habit
    'Perennial',     -- cycle
    '',       -- native_range_notes
    'LOW',   -- invasive_risk
    10,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    600.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    TRUE,           -- drought_tolerant
    TRUE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    6.0,          -- min_sun_hours
    12.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'LOW',  -- native_support
    'GOOD', -- container_suitability
    2.0, -- cooling_contribution
    1.8, -- privacy_contribution
    '["native_adapted","pest_companion","full_sun"]',                -- tags_json
    'Natural pesticide effect; large container (50L+); keep pruned on rooftops.',                    -- notes
    '',                -- image_url
    '',          -- image_thumbnail
    'CC',    -- image_license
    'scraped', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.1            -- data_confidence
  ),
  (
    'impatiens',                          -- code
    'Impatiens (Touch-me-not)',             -- display_name
    'Impatiens walleriana',          -- scientific_name
    'Balsaminaceae',                   -- family
    'Impatiens',                    -- genus
    'Plantae',                            -- kingdom
    'ORNAMENTAL',                 -- category
    'ORNAMENTAL',             -- growth_habit
    'Perennial',     -- cycle
    'Species of flowering plant',       -- native_range_notes
    'LOW',   -- invasive_risk
    10,                    -- hardiness_zone_min
    12,                    -- hardiness_zone_max
    60.0,                      -- max_height_cm
    FALSE,                     -- edible
    TRUE,                  -- flowering
    TRUE,                   -- pet_safe
    FALSE,           -- drought_tolerant
    FALSE,              -- heat_tolerant
    TRUE,            -- low_maintenance
    1.0,          -- min_sun_hours
    4.0,          -- max_sun_hours
    'MED', -- drought_tolerance
    'TROPICAL|HOT_HUMID',      -- climate_suitability
    'PART', -- sunlight_preference
    'MED',    -- water_demand
    'MED', -- maintenance_need
    'LOW', -- root_aggressiveness
    0.0,     -- pollinator_value
    'SAFE', -- child_pet_safety
    'HIGH',  -- native_support
    'GOOD', -- container_suitability
    1.5, -- cooling_contribution
    0.8, -- privacy_contribution
    '["shade_only","color","annual"]',                -- tags_json
    'Best shade annual; keep evenly moist; avoid harsh afternoon sun on rooftops.',                    -- notes
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Impatienswalleriana.jpg/330px-Impatienswalleriana.jpg',                -- image_url
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Impatienswalleriana.jpg/330px-Impatienswalleriana.jpg',          -- image_thumbnail
    'CC',    -- image_license
    'wikipedia', -- image_source
    1.0,            -- ml_weight
    TRUE,                                 -- active
    0.5            -- data_confidence
  )
;

-- ============================================================================
-- SECTION 4 — SELECTION RULE VIEWS
-- Each view directly mirrors a hard-exclusion or scoring rule from the
-- HeatWise recommendation engine (catalogHybridFallback.ts).
-- Use these views in training data pipelines and scenario validation.
-- ============================================================================

-- ── 4.1  Pet-safe species (HARD exclusion: petSafetyHardExclude) ─────────────
-- Engine rule: if session has child_pet_safe_required=1 AND species.dbPetSafe===false
--              → immediate exclusion regardless of score.
-- Corresponds to: HARD_PET_UNSAFE_SPECIES path in catalogHybridFallback.ts ~line 617
CREATE OR REPLACE VIEW view_pet_safe_species AS
SELECT
    code,
    display_name,
    scientific_name,
    category,
    child_pet_safety,
    pet_safe,
    edible,
    water_demand,
    sunlight_preference,
    cooling_contribution,
    container_suitability,
    tags_json
FROM species_catalog
WHERE pet_safe = TRUE
  AND child_pet_safety IN ('SAFE', 'CAUTION')
  AND active = TRUE
ORDER BY cooling_contribution DESC, display_name;

COMMENT ON VIEW view_pet_safe_species IS
  'Species passing the hard petSafetyHardExclude rule. child_pet_safety=CAUTION is '
  'included because the engine promotes them with a warning nudge rather than full exclusion.';

-- ── 4.2  Pet-UNSAFE species (excluded when pet_safe_required=1) ──────────────
CREATE OR REPLACE VIEW view_pet_unsafe_excluded AS
SELECT
    code,
    display_name,
    scientific_name,
    pet_safe,
    child_pet_safety,
    category,
    water_demand,
    notes
FROM species_catalog
WHERE pet_safe = FALSE OR child_pet_safety = 'UNSAFE'
ORDER BY display_name;

-- ── 4.3  Scarce-water eligible species (HARD exclusion: waterScarcityHardExclude) ─
-- Engine rule (effectiveWaterDemandNorm):
--   demand='' (unknown) AND dbDroughtTolerant!==true  → exclude
--   demand='high'                                     → exclude
--   demand='medium' AND NOT droughtTolerant           → downrank (not exclude)
-- This view shows candidates that PASS the scarce-water hard gate.
CREATE OR REPLACE VIEW view_scarce_water_eligible AS
SELECT
    code,
    display_name,
    scientific_name,
    drought_tolerant,
    drought_tolerance,
    water_demand,
    cooling_contribution,
    container_suitability,
    heat_tolerant,
    sunlight_preference,
    -- Effective demand label used by the engine
    CASE
        WHEN water_demand = 'LOW' THEN 'low'
        WHEN water_demand = 'MED' AND drought_tolerant THEN 'medium'
        WHEN water_demand = 'HIGH' THEN 'high'   -- this row never appears here (excluded above)
        ELSE 'unknown'
    END AS effective_demand_norm,
    -- scarce water priority factor: 2.0 for low demand, 1.5 for medium drought-tolerant
    CASE
        WHEN water_demand = 'LOW' THEN 2.0
        WHEN water_demand = 'MED' AND drought_tolerant THEN 1.5
        ELSE 1.0
    END AS scarce_water_priority_factor
FROM species_catalog
WHERE active = TRUE
  AND water_demand != 'HIGH'                        -- high demand → always excluded
  AND NOT (water_demand = 'MED' AND drought_tolerant = FALSE)  -- medium non-drought → excluded
  AND drought_tolerant = TRUE                       -- unknown demand → must be drought-tolerant
ORDER BY scarce_water_priority_factor DESC, cooling_contribution DESC;

COMMENT ON VIEW view_scarce_water_eligible IS
  'Mirrors waterScarcityHardExclude() in catalogHybridFallback.ts. '
  'Only species with LOW demand OR (MED demand AND drought_tolerant=TRUE) pass the scarce-water gate. '
  'HIGH demand and unknown-demand non-drought-tolerant species are excluded.';

-- ── 4.4  Full-sun capable species (shadeSunMismatchHardExclude) ──────────────
-- Engine rule: FULL_SUN site → exclude SHADE_ONLY species.
--              SHADE site   → exclude FULL_SUN_ONLY species.
-- This view lists species suitable for FULL SUN sites.
CREATE OR REPLACE VIEW view_full_sun_capable AS
SELECT
    code,
    display_name,
    scientific_name,
    sunlight_preference,
    min_sun_hours,
    max_sun_hours,
    heat_tolerant,
    drought_tolerant,
    cooling_contribution,
    category,
    container_suitability
FROM species_catalog
WHERE active = TRUE
  AND sunlight_preference IN ('FULL', 'BOTH')
  AND min_sun_hours >= 4
ORDER BY heat_tolerant DESC, cooling_contribution DESC;

-- ── 4.5  Shade-tolerant species (sites with sun_exposure = 'shade') ──────────
CREATE OR REPLACE VIEW view_shade_tolerant AS
SELECT
    code,
    display_name,
    scientific_name,
    sunlight_preference,
    min_sun_hours,
    max_sun_hours,
    cooling_contribution,
    pet_safe,
    container_suitability
FROM species_catalog
WHERE active = TRUE
  AND sunlight_preference IN ('PART', 'SHADE', 'BOTH')
ORDER BY cooling_contribution DESC;

-- ── 4.6  Container-eligible species (containerSuitabilityFilter) ──────────────
-- Engine rule: rooftop/balcony sessions always have container_suitable=true
--              required. POOR container suitability → exclude.
CREATE OR REPLACE VIEW view_container_eligible AS
SELECT
    code,
    display_name,
    scientific_name,
    container_suitability,
    category,
    root_aggressiveness,
    max_height_cm,
    water_demand,
    maintenance_need,
    cooling_contribution
FROM species_catalog
WHERE active = TRUE
  AND container_suitability IN ('GOOD', 'MODERATE')
ORDER BY container_suitability DESC, cooling_contribution DESC;

-- ── 4.7  High-invasive-risk species (informational — not a hard exclusion) ───
-- The engine applies a score demotion of 0.65× for HIGH invasive risk
-- and 0.85× for MODERATE. This view surfaces those species for auditing.
CREATE OR REPLACE VIEW view_invasive_risk_species AS
SELECT
    code,
    display_name,
    scientific_name,
    invasive_risk,
    CASE invasive_risk
        WHEN 'HIGH'     THEN 0.65
        WHEN 'MODERATE' THEN 0.85
        ELSE 1.0
    END AS invasive_score_multiplier,
    category,
    root_aggressiveness,
    container_suitability,
    notes
FROM species_catalog
WHERE invasive_risk IN ('HIGH', 'MODERATE')
  AND active = TRUE
ORDER BY invasive_risk, display_name;

-- ── 4.8  Edible & herb species (edibleDominance scoring rule) ────────────────
-- Engine rule: if session goals include EDIBLE_GARDEN, apply +25% score bonus
-- to edible species. If edible_herb_setup flag is set, enforce that ≥60% of
-- top-N candidates are edible (edibleDominanceTopOpen constraint).
CREATE OR REPLACE VIEW view_edible_species AS
SELECT
    code,
    display_name,
    scientific_name,
    category,
    edible,
    pet_safe,
    child_pet_safety,
    water_demand,
    drought_tolerant,
    sunlight_preference,
    maintenance_need,
    container_suitability,
    cooling_contribution,
    tags_json,
    notes
FROM species_catalog
WHERE edible = TRUE
  AND active = TRUE
ORDER BY maintenance_need, cooling_contribution DESC;

-- ── 4.9  Full recommendation-engine candidate pool ───────────────────────────
-- The universal starting pool: all active species regardless of session
-- constraints. Session constraints are applied as WHERE clauses at query time.
CREATE OR REPLACE VIEW view_all_active_candidates AS
SELECT
    code,
    display_name,
    scientific_name,
    family,
    category,
    growth_habit,
    cycle,
    edible,
    flowering,
    pet_safe,
    child_pet_safety,
    drought_tolerant,
    heat_tolerant,
    low_maintenance,
    min_sun_hours,
    max_sun_hours,
    drought_tolerance,
    climate_suitability,
    sunlight_preference,
    water_demand,
    maintenance_need,
    root_aggressiveness,
    pollinator_value,
    native_support,
    invasive_risk,
    container_suitability,
    cooling_contribution,
    privacy_contribution,
    hardiness_zone_min,
    hardiness_zone_max,
    max_height_cm,
    ml_weight,
    data_confidence,
    tags_json,
    notes,
    image_url,
    image_thumbnail
FROM species_catalog
WHERE active = TRUE
ORDER BY cooling_contribution DESC, display_name;


-- ============================================================================
-- SECTION 5 — SCORING FUNCTIONS
-- SQL equivalents of the catalogHybridFallback.ts scoring helpers.
-- Use these in training pipelines and scoring simulations.
-- ============================================================================

-- ── 5.1  Sun-match score (shadeSunMismatchScore) ─────────────────────────────
-- Inputs:  site_sun TEXT ('full'|'partial'|'shade')
--          species_sun sunlight_pref ('FULL'|'PART'|'SHADE'|'BOTH')
-- Returns: 0.0 (hard exclude) | 0.5 (mismatch) | 1.0 (match) | 1.2 (ideal)
CREATE OR REPLACE FUNCTION fn_sun_match_score(
    site_sun     TEXT,
    species_sun  TEXT
)
RETURNS NUMERIC AS $$
BEGIN
    -- Hard excludes
    IF site_sun = 'full'    AND species_sun = 'SHADE' THEN RETURN 0.0; END IF;
    IF site_sun = 'shade'   AND species_sun = 'FULL'  THEN RETURN 0.0; END IF;

    -- Perfect matches
    IF site_sun = 'full'    AND species_sun = 'FULL'  THEN RETURN 1.2; END IF;
    IF site_sun = 'shade'   AND species_sun = 'SHADE' THEN RETURN 1.2; END IF;
    IF site_sun = 'partial' AND species_sun = 'PART'  THEN RETURN 1.2; END IF;
    IF                           species_sun = 'BOTH'  THEN RETURN 1.1; END IF;

    -- Mismatches (not excluded but penalised)
    RETURN 0.7;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

COMMENT ON FUNCTION fn_sun_match_score(TEXT, TEXT) IS
  'Mirrors shadeSunMismatchScore() in catalogHybridFallback.ts. '
  'Returns 0.0 for hard excludes, 1.2 for ideal matches, 0.7 for mismatches.';

-- ── 5.2  Effective water demand normalisation ──────────────────────────────
-- Returns the normalized demand string used by the engine:
-- 'low' | 'medium' | 'high' | '' (unknown)
CREATE OR REPLACE FUNCTION fn_effective_water_demand(
    water_demand      TEXT,    -- 'LOW'|'MED'|'HIGH'
    drought_tolerant  BOOLEAN
)
RETURNS TEXT AS $$
BEGIN
    IF water_demand = 'LOW'  THEN RETURN 'low'; END IF;
    IF water_demand = 'HIGH' THEN RETURN 'high'; END IF;
    IF water_demand = 'MED' AND drought_tolerant THEN RETURN 'medium'; END IF;
    -- MED non-drought-tolerant → unknown (triggers exclusion in scarce water)
    RETURN '';
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- ── 5.3  Scarce-water hard exclusion predicate ────────────────────────────
-- Returns TRUE if species should be EXCLUDED for a scarce-water site.
CREATE OR REPLACE FUNCTION fn_is_scarce_water_excluded(
    water_demand      TEXT,
    drought_tolerant  BOOLEAN
)
RETURNS BOOLEAN AS $$
DECLARE
    demand TEXT;
BEGIN
    demand := fn_effective_water_demand(water_demand, drought_tolerant);
    -- '' = unknown demand AND not drought tolerant → exclude
    -- 'high' = always exclude in scarce water
    RETURN demand IN ('', 'high');
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- ── 5.4  Scarce-water priority factor ─────────────────────────────────────
-- Returns the priority multiplier applied to the base score in scarce-water sessions.
-- Source: scarceWaterPriorityFactor in catalogHybridFallback.ts
CREATE OR REPLACE FUNCTION fn_scarce_water_priority_factor(
    water_demand      TEXT,
    drought_tolerant  BOOLEAN
)
RETURNS NUMERIC AS $$
DECLARE
    demand TEXT;
BEGIN
    demand := fn_effective_water_demand(water_demand, drought_tolerant);
    IF demand = 'low'    THEN RETURN 2.0; END IF;
    IF demand = 'medium' THEN RETURN 1.5; END IF;
    RETURN 1.0;  -- unknown or excluded
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- ── 5.5  Maintenance score ─────────────────────────────────────────────────
-- Converts maintenance_need to a 0–1 score used in composite scoring.
-- High maintenance = lower score; low maintenance = higher score.
CREATE OR REPLACE FUNCTION fn_maintenance_score(
    maintenance_need  TEXT    -- 'LOW'|'MED'|'HIGH'
)
RETURNS NUMERIC AS $$
BEGIN
    IF maintenance_need = 'LOW' THEN RETURN 1.0; END IF;
    IF maintenance_need = 'MED' THEN RETURN 0.7; END IF;
    IF maintenance_need = 'HIGH' THEN RETURN 0.4; END IF;
    RETURN 0.7;  -- default
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- ── 5.6  Container suitability score ──────────────────────────────────────
-- POOR container suitability is a hard exclude for rooftop sessions.
-- MODERATE gets a 0.8× multiplier; GOOD gets 1.0×.
CREATE OR REPLACE FUNCTION fn_container_score(
    container_suitability  TEXT   -- 'GOOD'|'MODERATE'|'POOR'
)
RETURNS NUMERIC AS $$
BEGIN
    IF container_suitability = 'GOOD'     THEN RETURN 1.0; END IF;
    IF container_suitability = 'MODERATE' THEN RETURN 0.8; END IF;
    RETURN 0.0;  -- POOR → hard exclude
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- ── 5.7  Composite base score ──────────────────────────────────────────────
-- Approximation of the base scoring formula in catalogHybridFallback.ts.
-- Weights: cooling 0.35, maintenance 0.20, container 0.15, confidence 0.10,
--          pollinator_value 0.10, privacy_contribution 0.10
CREATE OR REPLACE FUNCTION fn_base_score(
    cooling_contribution  NUMERIC,
    maintenance_need      TEXT,
    container_suitability TEXT,
    data_confidence       NUMERIC,
    pollinator_value      NUMERIC,
    privacy_contribution  NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
    score NUMERIC;
BEGIN
    score :=
        (LEAST(cooling_contribution, 5.0) / 5.0)  * 0.35
        + fn_maintenance_score(maintenance_need)    * 0.20
        + fn_container_score(container_suitability) * 0.15
        + COALESCE(data_confidence, 0.5)            * 0.10
        + LEAST(COALESCE(pollinator_value, 0), 1.0) * 0.10
        + LEAST(COALESCE(privacy_contribution, 0) / 5.0, 1.0) * 0.10;
    RETURN ROUND(score, 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;


-- ============================================================================
-- SECTION 6 — TRAINING QUERIES & AGGREGATE STATISTICS
-- Run these to understand dataset distribution, score ranges, and engine
-- coverage. Use results to diagnose bias and guide model training.
-- ============================================================================

-- ── 6.1  Dataset overview ────────────────────────────────────────────────────
-- Quick sanity-check: counts by category and key booleans.
SELECT
    category,
    COUNT(*)                                       AS total,
    SUM(CASE WHEN edible THEN 1 ELSE 0 END)        AS edible,
    SUM(CASE WHEN pet_safe THEN 1 ELSE 0 END)      AS pet_safe,
    SUM(CASE WHEN drought_tolerant THEN 1 ELSE 0 END) AS drought_tolerant,
    SUM(CASE WHEN heat_tolerant THEN 1 ELSE 0 END) AS heat_tolerant,
    SUM(CASE WHEN low_maintenance THEN 1 ELSE 0 END) AS low_maintenance,
    ROUND(AVG(cooling_contribution), 2)            AS avg_cooling,
    ROUND(AVG(data_confidence), 2)                 AS avg_confidence
FROM species_catalog
WHERE active = TRUE
GROUP BY category
ORDER BY total DESC;

-- ── 6.2  Sunlight preference distribution ────────────────────────────────────
SELECT
    sunlight_preference,
    COUNT(*)  AS species_count,
    ROUND(AVG(cooling_contribution), 2) AS avg_cooling,
    ROUND(AVG(min_sun_hours), 1)        AS avg_min_sun_hrs,
    ROUND(AVG(max_sun_hours), 1)        AS avg_max_sun_hrs
FROM species_catalog
WHERE active = TRUE
GROUP BY sunlight_preference
ORDER BY species_count DESC;

-- ── 6.3  Water demand distribution ───────────────────────────────────────────
SELECT
    water_demand,
    drought_tolerant,
    fn_effective_water_demand(water_demand, drought_tolerant) AS effective_demand,
    COUNT(*) AS species_count,
    ROUND(AVG(cooling_contribution), 2) AS avg_cooling
FROM species_catalog
WHERE active = TRUE
GROUP BY water_demand, drought_tolerant
ORDER BY water_demand, drought_tolerant;

-- ── 6.4  Container suitability distribution ───────────────────────────────────
SELECT
    container_suitability,
    COUNT(*) AS total,
    SUM(CASE WHEN drought_tolerant THEN 1 ELSE 0 END) AS drought_tolerant,
    SUM(CASE WHEN pet_safe THEN 1 ELSE 0 END)         AS pet_safe,
    ROUND(AVG(cooling_contribution), 2)               AS avg_cooling,
    ROUND(AVG(max_height_cm), 0)                      AS avg_max_height_cm
FROM species_catalog
WHERE active = TRUE
GROUP BY container_suitability
ORDER BY container_suitability;

-- ── 6.5  Cooling contribution histogram (0.5-point buckets) ─────────────────
SELECT
    ROUND(FLOOR(cooling_contribution * 2) / 2, 1) AS bucket_min,
    ROUND(FLOOR(cooling_contribution * 2) / 2 + 0.5, 1) AS bucket_max,
    COUNT(*) AS species_count,
    STRING_AGG(code, ', ' ORDER BY code) AS codes
FROM species_catalog
WHERE active = TRUE
GROUP BY FLOOR(cooling_contribution * 2)
ORDER BY bucket_min;

-- ── 6.6  Base score distribution (using fn_base_score) ───────────────────────
SELECT
    code,
    display_name,
    category,
    cooling_contribution,
    fn_base_score(
        cooling_contribution,
        maintenance_need,
        container_suitability,
        data_confidence,
        pollinator_value,
        privacy_contribution
    ) AS base_score,
    fn_effective_water_demand(water_demand, drought_tolerant) AS effective_demand,
    fn_scarce_water_priority_factor(water_demand, drought_tolerant) AS sw_priority
FROM species_catalog
WHERE active = TRUE
ORDER BY base_score DESC;

-- ── 6.7  Scenario: FULL SUN + SCARCE WATER + PET SAFE ───────────────────────
-- Simulates the recommendation engine eligibility gate for a typical urban
-- Indian rooftop: full sun, water-scarce, pet-safe required.
-- This is a training-time simulation of catalogHybridFallback eligibility.
WITH eligible AS (
    SELECT
        code,
        display_name,
        scientific_name,
        category,
        cooling_contribution,
        pet_safe,
        drought_tolerant,
        water_demand,
        sunlight_preference,
        container_suitability,
        fn_sun_match_score('full', sunlight_preference)           AS sun_score,
        fn_scarce_water_priority_factor(water_demand, drought_tolerant) AS sw_factor,
        fn_base_score(
            cooling_contribution, maintenance_need, container_suitability,
            data_confidence, pollinator_value, privacy_contribution
        ) AS base_score
    FROM species_catalog
    WHERE active = TRUE
      -- Hard gates
      AND fn_sun_match_score('full', sunlight_preference) > 0.0         -- sun match
      AND NOT fn_is_scarce_water_excluded(water_demand, drought_tolerant) -- water gate
      AND pet_safe = TRUE                                                  -- pet safe
      AND container_suitability != 'POOR'                                  -- container fit
)
SELECT
    code,
    display_name,
    category,
    cooling_contribution,
    sun_score,
    sw_factor,
    ROUND(base_score * sun_score * sw_factor, 4)   AS composite_score,
    water_demand,
    sunlight_preference
FROM eligible
ORDER BY composite_score DESC
LIMIT 20;

-- ── 6.8  Scenario: SHADE + EDIBLE GARDEN (no pet constraint) ─────────────────
WITH eligible AS (
    SELECT
        code,
        display_name,
        category,
        edible,
        cooling_contribution,
        water_demand,
        sunlight_preference,
        fn_sun_match_score('shade', sunlight_preference)  AS sun_score,
        fn_base_score(
            cooling_contribution, maintenance_need, container_suitability,
            data_confidence, pollinator_value, privacy_contribution
        ) AS base_score,
        -- Edible garden bonus: +25% if edible
        CASE WHEN edible THEN 1.25 ELSE 1.0 END AS edible_bonus
    FROM species_catalog
    WHERE active = TRUE
      AND fn_sun_match_score('shade', sunlight_preference) > 0.0
      AND container_suitability != 'POOR'
)
SELECT
    code,
    display_name,
    category,
    edible,
    cooling_contribution,
    sun_score,
    edible_bonus,
    ROUND(base_score * sun_score * edible_bonus, 4) AS composite_score,
    sunlight_preference
FROM eligible
ORDER BY composite_score DESC
LIMIT 20;

-- ── 6.9  Pet-safe cross-check: species marked pet_safe=TRUE but child_pet_safety=UNSAFE ─
-- These rows violate the CHECK constraint and should never exist.
-- Run as a data-quality assertion.
SELECT code, display_name, pet_safe, child_pet_safety
FROM species_catalog
WHERE pet_safe = TRUE AND child_pet_safety = 'UNSAFE';
-- Expected result: 0 rows

-- ── 6.10  Data confidence audit ───────────────────────────────────────────────
-- Flag species with low confidence for manual review before training.
SELECT
    code,
    display_name,
    scientific_name,
    data_confidence,
    CASE
        WHEN data_confidence >= 0.8 THEN 'HIGH — use for training'
        WHEN data_confidence >= 0.5 THEN 'MEDIUM — verify before training'
        ELSE 'LOW — manual review required'
    END AS confidence_tier,
    notes
FROM species_catalog
WHERE active = TRUE
ORDER BY data_confidence ASC, code;


-- ============================================================================
-- SECTION 7 — EXAMPLE RECOMMENDATION SELECTION QUERIES
-- Annotated production-style queries showing how all engine rules map to SQL.
-- Copy and parameterize for use in the Next.js API layer or ML pipeline.
-- ============================================================================

-- ── 7.1  Full recommendation pipeline (parameterised) ─────────────────────────
-- Replace the VALUES in the CTE with session parameters from the API request.
-- This mirrors the execution order in catalogHybridFallback.ts:
--   1. Hard exclusions (sun, water, pet, container)
--   2. Scoring (base × modifiers × bonuses)
--   3. Rank and return top-N

WITH session_params AS (
    -- ── Inject session parameters here ──
    SELECT
        'full'     AS site_sun,          -- 'full' | 'partial' | 'shade'
        TRUE       AS scarce_water,       -- TRUE if water_budget = 'scarce'
        TRUE       AS pet_safe_required,  -- TRUE if child_pet_safe_required
        TRUE       AS rooftop_container,  -- TRUE for rooftop/balcony sessions
        'OUTDOOR_ROOFTOP' AS space_type,
        'EDIBLE_GARDEN'   AS goal,        -- primary user goal
        10         AS top_n              -- how many candidates to return
),
hard_excluded AS (
    -- ── Step 1: Apply all hard-exclusion gates ───────────────────────────────
    SELECT
        s.*,
        sp.site_sun,
        sp.scarce_water,
        sp.pet_safe_required,
        sp.rooftop_container,
        sp.goal,
        -- Compute derived scores
        fn_sun_match_score(sp.site_sun, s.sunlight_preference)           AS sun_score,
        fn_scarce_water_priority_factor(s.water_demand, s.drought_tolerant) AS sw_factor,
        fn_is_scarce_water_excluded(s.water_demand, s.drought_tolerant)  AS sw_excluded,
        CASE WHEN sp.goal = 'EDIBLE_GARDEN' AND s.edible THEN 1.25 ELSE 1.0 END AS goal_bonus,
        CASE s.invasive_risk
            WHEN 'HIGH'     THEN 0.65
            WHEN 'MODERATE' THEN 0.85
            ELSE 1.0
        END AS invasive_penalty
    FROM species_catalog s
    CROSS JOIN session_params sp
    WHERE s.active = TRUE
),
eligible AS (
    SELECT *
    FROM hard_excluded
    WHERE
        -- Gate 1: sun/shade mismatch hard exclude
        sun_score > 0.0
        -- Gate 2: scarce water hard exclude (only if session has scarce_water=TRUE)
        AND (NOT scarce_water OR NOT sw_excluded)
        -- Gate 3: pet safety hard exclude (only if session has pet_safe_required=TRUE)
        AND (NOT pet_safe_required OR pet_safe = TRUE)
        -- Gate 4: container suitability (rooftop sessions always require containable species)
        AND (NOT rooftop_container OR container_suitability != 'POOR')
),
scored AS (
    SELECT
        code,
        display_name,
        scientific_name,
        category,
        edible,
        pet_safe,
        child_pet_safety,
        drought_tolerant,
        heat_tolerant,
        water_demand,
        sunlight_preference,
        container_suitability,
        cooling_contribution,
        privacy_contribution,
        maintenance_need,
        max_height_cm,
        tags_json,
        image_url,
        image_thumbnail,
        notes,
        sun_score,
        sw_factor,
        goal_bonus,
        invasive_penalty,
        -- Composite score: base × sun match × scarce-water priority × goal bonus × invasive penalty
        ROUND(
            fn_base_score(
                cooling_contribution, maintenance_need, container_suitability,
                data_confidence, pollinator_value, privacy_contribution
            )
            * sun_score
            * sw_factor
            * goal_bonus
            * invasive_penalty,
            4
        ) AS composite_score
    FROM eligible
)
SELECT
    ROW_NUMBER() OVER (ORDER BY composite_score DESC) AS rank,
    code,
    display_name,
    category,
    edible,
    pet_safe,
    water_demand,
    sunlight_preference,
    cooling_contribution,
    composite_score,
    sun_score,
    sw_factor,
    goal_bonus,
    invasive_penalty,
    image_thumbnail
FROM scored
ORDER BY composite_score DESC
LIMIT (SELECT top_n FROM session_params);

-- ── 7.2  Generate ML training feature rows ────────────────────────────────────
-- Produces a CSV-compatible result set matching the format expected by
-- ml/data/bootstrap/sample_outputs/demo_pack/species_features.csv
-- (15-column ML CSV consumed by the Python serving pipeline).
SELECT
    code                                                AS species_key,
    CASE
        WHEN climate_suitability LIKE '%HOT_HUMID%' OR climate_suitability LIKE '%TROPICAL%' THEN 0.9
        WHEN climate_suitability LIKE '%HOT_DRY%'   THEN 0.85
        WHEN climate_suitability LIKE '%SUBTROPICAL%' THEN 0.75
        ELSE 0.6
    END                                                AS climate_suitability,
    CASE sunlight_preference
        WHEN 'FULL'  THEN 1.0
        WHEN 'BOTH'  THEN 0.75
        WHEN 'PART'  THEN 0.5
        WHEN 'SHADE' THEN 0.25
        ELSE 0.5
    END                                                AS sunlight_preference,
    CASE water_demand
        WHEN 'LOW'  THEN 0.3
        WHEN 'MED'  THEN 0.6
        WHEN 'HIGH' THEN 0.9
        ELSE 0.5
    END                                                AS water_demand,
    CASE maintenance_need
        WHEN 'LOW'  THEN 0.2
        WHEN 'MED'  THEN 0.5
        WHEN 'HIGH' THEN 0.8
        ELSE 0.5
    END                                                AS maintenance_score,
    LEAST(cooling_contribution / 5.0, 1.0)             AS cooling_score,
    CASE container_suitability
        WHEN 'GOOD'     THEN 0.9
        WHEN 'MODERATE' THEN 0.6
        WHEN 'POOR'     THEN 0.1
        ELSE 0.5
    END                                                AS container_score,
    CASE WHEN pet_safe THEN 1.0 ELSE 0.0 END           AS pet_safe_score,
    CASE WHEN edible THEN 1.0 ELSE 0.0 END             AS edible_score,
    CASE WHEN drought_tolerant THEN 1.0 ELSE 0.0 END   AS drought_score,
    CASE WHEN heat_tolerant THEN 1.0 ELSE 0.0 END      AS heat_score,
    LEAST(COALESCE(pollinator_value, 0), 1.0)          AS pollinator_score,
    LEAST(COALESCE(privacy_contribution, 0) / 5.0, 1.0) AS privacy_score,
    COALESCE(ml_weight, 1.0)                           AS ml_weight,
    COALESCE(data_confidence, 0.5)                     AS data_confidence
FROM species_catalog
WHERE active = TRUE
ORDER BY code;

-- ── 7.3  Recommendation telemetry join (for post-deploy analysis) ─────────────
-- Join species_catalog with the telemetry tables to analyse which species
-- are being recommended vs. selected vs. installed in production.
-- (Requires the full Prisma schema tables: RecommendationCandidateSnapshot,
--  RecommendationTelemetryEvent)
--
-- SELECT
--     sc.code,
--     sc.display_name,
--     sc.category,
--     sc.cooling_contribution,
--     COUNT(DISTINCT rcs.id)                           AS times_recommended,
--     SUM(CASE WHEN rte.event_type = 'SELECTED' THEN 1 ELSE 0 END) AS times_selected,
--     SUM(CASE WHEN rte.event_type = 'INSTALLED' THEN 1 ELSE 0 END) AS times_installed,
--     ROUND(
--         SUM(CASE WHEN rte.event_type = 'SELECTED' THEN 1 ELSE 0 END)::NUMERIC
--         / NULLIF(COUNT(DISTINCT rcs.id), 0),
--         3
--     ) AS selection_rate
-- FROM species_catalog sc
-- LEFT JOIN "RecommendationCandidateSnapshot" rcs
--     ON rcs.species_codes::jsonb ? sc.code
-- LEFT JOIN "RecommendationTelemetryEvent" rte
--     ON rte.session_id = rcs.session_id AND rte.species_code = sc.code
-- WHERE sc.active = TRUE
-- GROUP BY sc.code, sc.display_name, sc.category, sc.cooling_contribution
-- ORDER BY times_recommended DESC;


-- ============================================================================
-- END OF heatwise_species_dataset.sql
-- Generated: 2026-04-02
-- Species count: 51 | Columns: 43 | Views: 9 | Functions: 7 | Training queries: 10
-- ============================================================================
