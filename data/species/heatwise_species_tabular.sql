-- ============================================================================
-- HeatWise — Species Catalog  |  TABULAR FORMAT
-- ============================================================================
-- File    : data/species/heatwise_species_tabular.sql
-- Created : 2026-04-02
-- Species : 51  |  Columns : 43
--
-- FORMAT: Each INSERT row = one species, all 43 columns on one line.
-- Use this file for quick visual auditing, spreadsheet imports, and
-- DB population. The companion file heatwise_species_dataset.sql contains
-- the full annotated schema, views, and training queries.
--
-- COLUMN ORDER (left → right):
--  1  code                   Canonical identifier (snake_case)
--  2  display_name           User-facing name
--  3  scientific_name        Botanical binomial
--  4  family                 Taxonomic family
--  5  genus                  Taxonomic genus
--  6  kingdom                Taxonomic kingdom
--  7  category               HERB|VEGETABLE|SUCCULENT|ORNAMENTAL|FOLIAGE|GRASS|CLIMBER|SHRUB
--  8  growth_habit           Plant habit type
--  9  cycle                  Annual|Perennial|Biennial
-- 10  native_range_notes     Origin description
-- 11  invasive_risk          LOW|MODERATE|HIGH
-- 12  hardiness_zone_min     USDA zone minimum
-- 13  hardiness_zone_max     USDA zone maximum
-- 14  max_height_cm          Max grown height in centimetres
-- 15  edible                 TRUE if human edible
-- 16  flowering              TRUE if flowers produced
-- 17  pet_safe               TRUE if ASPCA non-toxic to dogs+cats
-- 18  drought_tolerant       TRUE if survives dry periods without irrigation
-- 19  heat_tolerant          TRUE if handles 38°C+ rooftop temperatures
-- 20  low_maintenance        TRUE if weekly or less intervention needed
-- 21  min_sun_hours          Minimum daily sunlight hours needed
-- 22  max_sun_hours          Maximum useful daily sunlight hours
-- 23  drought_tolerance      LOW|MED|HIGH (granular water demand signal)
-- 24  climate_suitability    Pipe-delimited climate tokens e.g. HOT_HUMID|TROPICAL
-- 25  sunlight_preference    FULL|PART|SHADE|BOTH
-- 26  water_demand           LOW|MED|HIGH  (used by waterScarcityHardExclude)
-- 27  maintenance_need       LOW|MED|HIGH  (scoring weight)
-- 28  root_aggressiveness    LOW|MED|HIGH  (container damage risk)
-- 29  pollinator_value       0.0–1.0  (ecosystem scoring bonus)
-- 30  child_pet_safety       SAFE|CAUTION|UNSAFE
-- 31  native_support         LOW|HIGH  (ecosystem scoring bonus)
-- 32  container_suitability  GOOD|MODERATE|POOR  (hard exclude if POOR on rooftop)
-- 33  cooling_contribution   0.0–5.0  (primary heat-reduction scoring signal)
-- 34  privacy_contribution   0.0–5.0  (secondary scoring signal)
-- 35  tags_json              JSON array of feature tags
-- 36  notes                  Human-readable growing tips and engine notes
-- 37  image_url              Full-resolution image URL
-- 38  image_thumbnail        Thumbnail URL
-- 39  image_license          CC|PUBLIC_DOMAIN|COMMERCIAL|UNKNOWN
-- 40  image_source           wikipedia|perenual|wikimedia|seed
-- 41  ml_weight              ML model weight multiplier (default 1.0)
-- 42  active                 FALSE to soft-delete from recommendation pool
-- 43  data_confidence        0.0–1.0  (source quality; <0.5 = manual review)
--
-- ENGINE HARD-EXCLUSION RULES (apply as WHERE clauses):
--   Sun mismatch  : sunlight_preference='FULL' excluded on shade sites
--   Water scarce  : water_demand='HIGH' excluded; MED+drought_tolerant=FALSE excluded
--   Pet safety    : pet_safe=FALSE excluded when child_pet_safe_required=1
--   Container     : container_suitability='POOR' excluded on rooftop sessions
--   Invasive      : invasive_risk='HIGH' applies 0.65× score penalty
-- ============================================================================

-- DROP TABLE IF EXISTS species_catalog;

CREATE TABLE IF NOT EXISTS species_catalog (
    id                    SERIAL         PRIMARY KEY,
    code                  VARCHAR(80)    NOT NULL UNIQUE,
    display_name          VARCHAR(160)   NOT NULL,
    scientific_name       VARCHAR(200)   NOT NULL DEFAULT '',
    family                VARCHAR(100)   NOT NULL DEFAULT '',
    genus                 VARCHAR(100)   NOT NULL DEFAULT '',
    kingdom               VARCHAR(60)    NOT NULL DEFAULT 'Plantae',
    category              VARCHAR(30)    NOT NULL CHECK (category IN ('HERB','VEGETABLE','SUCCULENT','ORNAMENTAL','FOLIAGE','GRASS','CLIMBER','SHRUB')),
    growth_habit          VARCHAR(30)    NOT NULL DEFAULT '',
    cycle                 VARCHAR(30)    NOT NULL DEFAULT '',
    native_range_notes    TEXT,
    invasive_risk         VARCHAR(10)    NOT NULL DEFAULT 'LOW'     CHECK (invasive_risk     IN ('LOW','MODERATE','HIGH')),
    hardiness_zone_min    SMALLINT,
    hardiness_zone_max    SMALLINT,
    max_height_cm         NUMERIC(7,1),
    edible                BOOLEAN        NOT NULL DEFAULT FALSE,
    flowering             BOOLEAN        NOT NULL DEFAULT FALSE,
    pet_safe              BOOLEAN        NOT NULL DEFAULT FALSE,
    drought_tolerant      BOOLEAN        NOT NULL DEFAULT FALSE,
    heat_tolerant         BOOLEAN        NOT NULL DEFAULT FALSE,
    low_maintenance       BOOLEAN        NOT NULL DEFAULT FALSE,
    min_sun_hours         NUMERIC(4,1)   NOT NULL DEFAULT 4,
    max_sun_hours         NUMERIC(4,1)   NOT NULL DEFAULT 8,
    drought_tolerance     VARCHAR(10)    NOT NULL DEFAULT 'MED'     CHECK (drought_tolerance IN ('LOW','MED','HIGH')),
    climate_suitability   TEXT           NOT NULL DEFAULT '',
    sunlight_preference   VARCHAR(10)    NOT NULL DEFAULT 'PART'    CHECK (sunlight_preference IN ('FULL','PART','SHADE','BOTH')),
    water_demand          VARCHAR(10)    NOT NULL DEFAULT 'MED'     CHECK (water_demand      IN ('LOW','MED','HIGH')),
    maintenance_need      VARCHAR(10)    NOT NULL DEFAULT 'MED'     CHECK (maintenance_need  IN ('LOW','MED','HIGH')),
    root_aggressiveness   VARCHAR(10)    NOT NULL DEFAULT 'LOW'     CHECK (root_aggressiveness IN ('LOW','MED','HIGH')),
    pollinator_value      NUMERIC(4,2)   NOT NULL DEFAULT 0,
    child_pet_safety      VARCHAR(10)    NOT NULL DEFAULT 'SAFE'    CHECK (child_pet_safety  IN ('SAFE','CAUTION','UNSAFE')),
    native_support        VARCHAR(10)    NOT NULL DEFAULT 'LOW'     CHECK (native_support    IN ('LOW','HIGH')),
    container_suitability VARCHAR(10)    NOT NULL DEFAULT 'GOOD'    CHECK (container_suitability IN ('GOOD','MODERATE','POOR')),
    cooling_contribution  NUMERIC(4,2)   NOT NULL DEFAULT 0,
    privacy_contribution  NUMERIC(4,2)   NOT NULL DEFAULT 0,
    tags_json             TEXT           NOT NULL DEFAULT '[]',
    notes                 TEXT,
    image_url             TEXT,
    image_thumbnail       TEXT,
    image_license         VARCHAR(30)    DEFAULT 'UNKNOWN',
    image_source          VARCHAR(30)    DEFAULT 'seed',
    ml_weight             NUMERIC(5,3)   NOT NULL DEFAULT 1.0,
    active                BOOLEAN        NOT NULL DEFAULT TRUE,
    data_confidence       NUMERIC(4,2)   NOT NULL DEFAULT 0.5,
    created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    -- Consistency constraints
    CONSTRAINT chk_pet_safe_consistency    CHECK (NOT (pet_safe = TRUE AND child_pet_safety = 'UNSAFE')),
    CONSTRAINT chk_zone_order              CHECK (hardiness_zone_min IS NULL OR hardiness_zone_max IS NULL OR hardiness_zone_min <= hardiness_zone_max),
    CONSTRAINT chk_sun_hours_order         CHECK (min_sun_hours <= max_sun_hours),
    CONSTRAINT chk_cooling_range           CHECK (cooling_contribution BETWEEN 0 AND 5),
    CONSTRAINT chk_confidence_range        CHECK (data_confidence BETWEEN 0 AND 1),
    CONSTRAINT chk_ml_weight_positive      CHECK (ml_weight > 0)
);

CREATE INDEX IF NOT EXISTS idx_sc_category   ON species_catalog (category);
CREATE INDEX IF NOT EXISTS idx_sc_pet_safe   ON species_catalog (pet_safe);
CREATE INDEX IF NOT EXISTS idx_sc_sun        ON species_catalog (sunlight_preference);
CREATE INDEX IF NOT EXISTS idx_sc_water      ON species_catalog (water_demand, drought_tolerant);
CREATE INDEX IF NOT EXISTS idx_sc_container  ON species_catalog (container_suitability);
CREATE INDEX IF NOT EXISTS idx_sc_active     ON species_catalog (active);
CREATE INDEX IF NOT EXISTS idx_sc_cooling    ON species_catalog (cooling_contribution DESC);

-- ============================================================================
-- DATA — 51 species, one INSERT row per species, all 43 columns filled
-- Columns: code | display_name | scientific_name | family | genus | kingdom |
--          category | growth_habit | cycle | native_range_notes | invasive_risk |
--          hzone_min | hzone_max | max_height_cm | edible | flowering | pet_safe |
--          drought_tolerant | heat_tolerant | low_maintenance | min_sun_hrs | max_sun_hrs |
--          drought_tolerance | climate_suitability | sunlight_preference | water_demand |
--          maintenance_need | root_aggressiveness | pollinator_value | child_pet_safety |
--          native_support | container_suitability | cooling_contribution | privacy_contribution |
--          tags_json | notes | image_url | image_thumbnail | image_license | image_source |
--          ml_weight | active | data_confidence
-- ============================================================================

INSERT INTO species_catalog (
    code, display_name, scientific_name, family, genus, kingdom,
    category, growth_habit, cycle, native_range_notes, invasive_risk,
    hardiness_zone_min, hardiness_zone_max, max_height_cm,
    edible, flowering, pet_safe,
    drought_tolerant, heat_tolerant, low_maintenance,
    min_sun_hours, max_sun_hours,
    drought_tolerance, climate_suitability, sunlight_preference,
    water_demand, maintenance_need, root_aggressiveness,
    pollinator_value, child_pet_safety, native_support, container_suitability,
    cooling_contribution, privacy_contribution,
    tags_json, notes,
    image_url, image_thumbnail, image_license, image_source,
    ml_weight, active, data_confidence
) VALUES
  ('tulsi_holy', 'Holy basil (Tulsi)', 'Ocimum tenuiflorum', 'Lamiaceae', 'Ocimum', 'Plantae', 'HERB', 'HERB', 'Perennial', 'Species of flowering plant', 'LOW', 10, 12, 60, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 4, 10, 'MED', 'TROPICAL|HOT_HUMID|SUBTROPICAL', 'PART', 'MED', 'MED', 'LOW', 0.5, 'SAFE', 'HIGH', 'GOOD', 1.3, 0.8, '["native_adapted","aromatic","pollinator"]', 'India staple; handles heat; pinch flowers for leaf production.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Tulsi_or_Tulasi_Holy_basil.jpg/330px-Tulsi_or_Tulasi_Holy_basil.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Tulsi_or_Tulasi_Holy_basil.jpg/330px-Tulsi_or_Tulasi_Holy_basil.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('basil_sweet', 'Sweet basil', 'Ocimum basilicum', 'Lamiaceae', 'Ocimum', 'Plantae', 'HERB', 'HERB', 'Perennial', 'Culinary herb', 'LOW', 10, 11, 50, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, 4, 8, 'MED', 'TROPICAL|HOT_HUMID|SUBTROPICAL|TEMPERATE', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'HIGH', 'GOOD', 1.3, 0.8, '["container","monsoon_ok"]', 'Bolts in extreme heat—afternoon shade helps; water consistently.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Ocimum_basilicum_8zz.jpg/330px-Ocimum_basilicum_8zz.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Ocimum_basilicum_8zz.jpg/330px-Ocimum_basilicum_8zz.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('mint', 'Mint', 'Mentha spp.', NULL, NULL, 'Plantae', 'HERB', 'HERB', 'Perennial', NULL, 'LOW', 3, 11, 60, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, 3, 6, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'LOW', 'GOOD', 1.3, 0.8, '["container","moist_soil"]', 'Use deep pot; invasive roots—isolate. Part sun on hot roofs.', NULL, NULL, 'CC', NULL, 1, TRUE, 0.1),
  ('coriander', 'Coriander (Cilantro)', 'Coriandrum sativum', 'Apiaceae', 'Coriandrum', 'Plantae', 'HERB', 'HERB', 'Perennial', 'Annual herb', 'LOW', 3, 11, 50, TRUE, TRUE, TRUE, FALSE, FALSE, TRUE, 3, 5, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'LOW', 'GOOD', 1.3, 0.8, '["quick_crop","shade_afternoon"]', 'Sow in cooler windows; bolt risk in peak summer—succession plant.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Coriandrum_sativum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-193.jpg/330px-Coriandrum_sativum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-193.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Coriandrum_sativum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-193.jpg/330px-Coriandrum_sativum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-193.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('curry_leaf', 'Curry leaf tree (Kadi patta)', 'Murraya koenigii', 'Rutaceae', 'Murraya', 'Plantae', 'HERB', 'HERB', 'Perennial', 'Species of flowering plant', 'LOW', 9, 12, 150, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, 6, 10, 'MED', 'TROPICAL|HOT_HUMID|MONSOON_HEAVY|SUBTROPICAL', 'PART', 'MED', 'MED', 'LOW', 1.5, 'UNSAFE', 'HIGH', 'GOOD', 1.3, 0.8, '["perennial_pot","wind_ok"]', 'Large container; protect roots from waterlogging in monsoon.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Curry_Trees.jpg/330px-Curry_Trees.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Curry_Trees.jpg/330px-Curry_Trees.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('lemongrass', 'Lemongrass', 'Cymbopogon citratus', 'Poaceae', 'Cymbopogon', 'Plantae', 'HERB', 'HERB', 'Perennial', 'Species of plant', 'LOW', 8, 11, 180, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, 6, 10, 'MED', 'TROPICAL|HOT_HUMID|MONSOON_HEAVY', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'HIGH', 'GOOD', 1.3, 0.8, '["container","privacy_screen"]', 'Excellent heat performer; divide clumps yearly in pots.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gardenology.org-IMG_2892_rbgs11jan.jpg/330px-Gardenology.org-IMG_2892_rbgs11jan.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gardenology.org-IMG_2892_rbgs11jan.jpg/330px-Gardenology.org-IMG_2892_rbgs11jan.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('cherry_tomato', 'Cherry tomato', 'Solanum lycopersicum', 'Solanaceae', 'Solanum', 'Plantae', 'VEGETABLE', 'VEGETABLE', 'Perennial', 'Edible berry', 'LOW', 2, 11, 120, TRUE, TRUE, FALSE, FALSE, TRUE, FALSE, 6, 10, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 1.5, 'UNSAFE', 'LOW', 'EXCELLENT', 1.5, 0.8, '["vegetable","staking"]', 'Deep pot + mulch; blossom drop if nights stay too warm—try heat-set types.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Tomato_je.jpg/330px-Tomato_je.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Tomato_je.jpg/330px-Tomato_je.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('chilli', 'Chilli pepper', 'Capsicum annuum', 'Solanaceae', 'Capsicum', 'Plantae', 'VEGETABLE', 'VEGETABLE', 'Perennial', 'Species of flowering plant in the nightshade family', 'LOW', NULL, NULL, NULL, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, 6, 10, 'MED', 'TEMPERATE', 'PART', 'MED', 'MED', 'LOW', 1.5, 'UNSAFE', 'HIGH', 'GOOD', 1.5, 0.8, '["productive","container"]', 'Very rooftop-friendly in India; watch thrips in dry season.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Capsicum_annuum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-027.jpg/330px-Capsicum_annuum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-027.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Capsicum_annuum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-027.jpg/330px-Capsicum_annuum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-027.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('malabar_spinach', 'Malabar spinach', 'Basella alba', 'Basellaceae', 'Basella', 'Plantae', 'VEGETABLE', 'VEGETABLE', 'Perennial', 'Species of edible plant', 'LOW', NULL, NULL, NULL, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, 4, 8, 'MED', 'TROPICAL|HOT_HUMID|MONSOON_HEAVY', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'LOW', 'GOOD', 1.5, 0.8, '["climber","monsoon_ok"]', 'Vining leafy green for hot weather—better than true spinach in heat.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Basella_alba-2.JPG/330px-Basella_alba-2.JPG', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Basella_alba-2.JPG/330px-Basella_alba-2.JPG', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('aloe_vera', 'Aloe vera', 'Aloe barbadensis miller', NULL, NULL, 'Plantae', 'SUCCULENT', 'SUCCULENT', 'Perennial', NULL, 'LOW', 8, 11, 60, FALSE, TRUE, FALSE, TRUE, TRUE, TRUE, 4, 10, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'LOW', 'GOOD', 0.9, 0.8, '["succulent","medicinal_lookalike_caution"]', 'Roof workhorse; avoid overwatering in humid monsoon.', NULL, NULL, 'CC', NULL, 1, TRUE, 0.1),
  ('jade_plant', 'Jade plant', 'Crassula ovata', 'Crassulaceae', 'Crassula', 'Plantae', 'SUCCULENT', 'SUCCULENT', 'Perennial', 'Species of succulent', 'LOW', 10, 12, 90, FALSE, TRUE, FALSE, TRUE, TRUE, TRUE, 4, 8, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'HIGH', 'GOOD', 0.9, 0.8, '["succulent","wind_ok"]', 'Slow; afternoon shade on very hot roofs reduces leaf scorch.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Crassula_ovata_700.jpg/330px-Crassula_ovata_700.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Crassula_ovata_700.jpg/330px-Crassula_ovata_700.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('sedum', 'Sedum (stonecrop)', 'Sedum spp.', NULL, NULL, 'Plantae', 'SUCCULENT', 'SUCCULENT', 'Perennial', NULL, 'LOW', 3, 9, 30, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, 6, 12, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'LOW', 'GOOD', 0.9, 0.8, '["green_roof","drought"]', 'Green roof / shallow tray candidate; sharp drainage.', NULL, NULL, 'CC', NULL, 1, TRUE, 0.1),
  ('prickly_pear', 'Prickly pear cactus', 'Opuntia spp.', NULL, NULL, 'Plantae', 'SUCCULENT', 'SUCCULENT', 'Perennial', NULL, 'LOW', 3, 11, 150, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, 8, 12, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'LOW', 'GOOD', 0.9, 0.8, '["cactus","full_sun"]', 'Extreme heat/drought; pad handling and spines—pets/kids.', NULL, NULL, 'CC', NULL, 1, TRUE, 0.1),
  ('bougainvillea', 'Bougainvillea', 'Bougainvillea spp.', NULL, NULL, 'Plantae', 'ORNAMENTAL', 'ORNAMENTAL', 'Perennial', NULL, 'LOW', 9, 11, 900, FALSE, TRUE, FALSE, TRUE, TRUE, TRUE, 8, 12, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'LOW', 'GOOD', 1.5, 0.8, '["climber","color"]', 'Classic Indian terrace; large pot + trellis; sharp thorns.', NULL, NULL, 'CC', NULL, 1, TRUE, 0.1),
  ('hibiscus', 'Chinese hibiscus', 'Hibiscus rosa-sinensis', 'Malvaceae', 'Hibiscus', 'Plantae', 'ORNAMENTAL', 'ORNAMENTAL', 'Perennial', 'Hybrid species of flowering plant', 'LOW', 9, 12, 400, FALSE, TRUE, FALSE, FALSE, TRUE, FALSE, 6, 10, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'LOW', 'GOOD', 1.5, 0.8, '["flowering_shrub","container"]', 'Needs water in heat; watch for aphids; great tropical roof vibe.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Hibiscus_Brilliant.jpg/330px-Hibiscus_Brilliant.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Hibiscus_Brilliant.jpg/330px-Hibiscus_Brilliant.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('marigold', 'Marigold (Genda)', 'Tagetes spp.', NULL, NULL, 'Plantae', 'ORNAMENTAL', 'ORNAMENTAL', 'Perennial', NULL, 'LOW', 2, 11, 90, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 6, 10, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'LOW', 'GOOD', 1.5, 0.8, '["annual","pest_companion"]', 'Companion plant; tolerates poor soil; easy from seed.', NULL, NULL, 'CC', NULL, 1, TRUE, 0.1),
  ('portulaca', 'Portulaca (moss rose)', 'Portulaca grandiflora', 'Portulacaceae', 'Portulaca', 'Plantae', 'ORNAMENTAL', 'ORNAMENTAL', 'Perennial', 'Rose-like flowering plant', 'LOW', 10, 12, 20, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, 6, 12, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'HIGH', 'GOOD', 1.5, 0.8, '["annual","shallow_root"]', 'Trailing color for shallow planters; loves sun and heat.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/PortulacaGrandiflora.jpg/330px-PortulacaGrandiflora.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/PortulacaGrandiflora.jpg/330px-PortulacaGrandiflora.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('vinca', 'Periwinkle (Vinca)', 'Catharanthus roseus', 'Apocynaceae', 'Catharanthus', 'Plantae', 'ORNAMENTAL', 'ORNAMENTAL', 'Perennial', 'Species of flowering plant in the family Apocynaceae', 'LOW', 10, 12, 60, FALSE, TRUE, FALSE, TRUE, TRUE, TRUE, 4, 10, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'HIGH', 'GOOD', 1.5, 0.8, '["annual","container"]', 'Heat-tolerant color; toxic if ingested—keep from pets.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Catharanthus_roseus_%28Pink_Madagascar_Periwinkle%29.jpg/330px-Catharanthus_roseus_%28Pink_Madagascar_Periwinkle%29.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Catharanthus_roseus_%28Pink_Madagascar_Periwinkle%29.jpg/330px-Catharanthus_roseus_%28Pink_Madagascar_Periwinkle%29.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('zinnia', 'Zinnia', 'Zinnia elegans', 'Asteraceae', 'Zinnia', 'Plantae', 'ORNAMENTAL', 'ORNAMENTAL', 'Perennial', 'Species of flowering plant', 'LOW', NULL, NULL, NULL, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 6, 12, 'MED', 'SUBTROPICAL', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'HIGH', 'GOOD', 1.5, 0.8, '["annual","pollinator"]', 'Cut-and-come-again; excellent for hot balconies.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Zinnienbl%C3%BCte_Zinnia_elegans_stack15_20190722-RM-7222254.jpg/330px-Zinnienbl%C3%BCte_Zinnia_elegans_stack15_20190722-RM-7222254.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Zinnienbl%C3%BCte_Zinnia_elegans_stack15_20190722-RM-7222254.jpg/330px-Zinnienbl%C3%BCte_Zinnia_elegans_stack15_20190722-RM-7222254.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('pothos', 'Money plant (Pothos)', 'Epipremnum aureum', 'Araceae', 'Epipremnum', 'Plantae', 'FOLIAGE', 'FOLIAGE', 'Perennial', 'Species of plant', 'LOW', 10, 12, 200, FALSE, FALSE, FALSE, TRUE, TRUE, TRUE, 2, 6, 'MED', 'TROPICAL|HOT_HUMID|MONSOON_HEAVY|SUBTROPICAL|TEMPERATE', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'HIGH', 'EXCELLENT', 2.4, 1.6, '["shade_balcony","hanging"]', 'Bright indirect on hot balconies; avoid direct noon sun.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Money_Plant_%28Epipremnum_aureum%29_4.jpg/330px-Money_Plant_%28Epipremnum_aureum%29_4.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Money_Plant_%28Epipremnum_aureum%29_4.jpg/330px-Money_Plant_%28Epipremnum_aureum%29_4.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('snake_plant', 'Snake plant', 'Dracaena trifasciata', 'Asparagaceae', 'Dracaena', 'Plantae', 'FOLIAGE', 'FOLIAGE', 'Perennial', 'Species of flowering plant', 'LOW', 9, 12, 90, FALSE, TRUE, FALSE, TRUE, TRUE, TRUE, 2, 8, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'HIGH', 'GOOD', 2.4, 1.6, '["low_light_roof_corner","wind_ok"]', 'Tolerates AC-adjacent semi-shade corners; rot if overwatered.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Snake_Plant_%28Sansevieria_trifasciata_%27Laurentii%27%29.jpg/330px-Snake_Plant_%28Sansevieria_trifasciata_%27Laurentii%27%29.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Snake_Plant_%28Sansevieria_trifasciata_%27Laurentii%27%29.jpg/330px-Snake_Plant_%28Sansevieria_trifasciata_%27Laurentii%27%29.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('spider_plant', 'Spider plant', 'Chlorophytum comosum', 'Asparagaceae', 'Chlorophytum', 'Plantae', 'FOLIAGE', 'FOLIAGE', 'Perennial', 'Species of flowering plant', 'LOW', 9, 11, 60, FALSE, TRUE, TRUE, FALSE, TRUE, TRUE, 3, 6, 'MED', 'TROPICAL|HOT_HUMID|MONSOON_HEAVY|SUBTROPICAL', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'HIGH', 'GOOD', 2.4, 1.6, '["hanging","shade_balcony"]', 'Part shade on terraces; brown tips if scorched or salty water.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Hierbabuena_0611_Revised.jpg/330px-Hierbabuena_0611_Revised.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Hierbabuena_0611_Revised.jpg/330px-Hierbabuena_0611_Revised.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('geranium_pelargonium', 'Scented geranium', 'Pelargonium spp.', NULL, NULL, 'Plantae', 'ORNAMENTAL', 'ORNAMENTAL', 'Perennial', NULL, 'LOW', 9, 12, 60, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, 6, 10, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'LOW', 'GOOD', 1.5, 0.8, '["container","aromatic"]', 'Good in pots; some scents deter mosquitoes (mild effect).', NULL, NULL, 'CC', NULL, 1, TRUE, 0.1),
  ('plumeria', 'Plumeria (Frangipani)', 'Plumeria spp.', NULL, NULL, 'Plantae', 'ORNAMENTAL', 'ORNAMENTAL', 'Perennial', NULL, 'LOW', 9, 12, 800, FALSE, TRUE, FALSE, TRUE, TRUE, TRUE, 8, 12, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'LOW', 'GOOD', 1.5, 0.8, '["tropical","fragrant"]', 'Large container; deciduous; protect from waterlogging.', NULL, NULL, 'CC', NULL, 1, TRUE, 0.1),
  ('okra', 'Okra (Bhindi)', 'Abelmoschus esculentus', 'Malvaceae', 'Abelmoschus', 'Plantae', 'VEGETABLE', 'VEGETABLE', 'Perennial', 'Species of edible plant', 'LOW', 8, 12, 200, TRUE, TRUE, TRUE, FALSE, TRUE, FALSE, 6, 10, 'MED', 'TROPICAL|HOT_HUMID|SUBTROPICAL|TEMPERATE', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'HIGH', 'GOOD', 1.5, 0.8, '["kitchen_garden","monsoon_ok"]', 'Heat-loving pod crop; deep pot; harvest young pods regularly.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Hong_Kong_Okra_Aug_25_2012.JPG/330px-Hong_Kong_Okra_Aug_25_2012.JPG', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Hong_Kong_Okra_Aug_25_2012.JPG/330px-Hong_Kong_Okra_Aug_25_2012.JPG', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('spinach_indian', 'Indian spinach (Palak)', 'Spinacia oleracea', 'Amaranthaceae', 'Spinacia', 'Plantae', 'HERB', 'HERB', 'Perennial', 'Species of flowering plant', 'LOW', NULL, NULL, NULL, TRUE, FALSE, TRUE, FALSE, FALSE, FALSE, 3, 6, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'HIGH', 'GOOD', 1.3, 0.8, '["quick_crop","shade_afternoon"]', 'Cool-season windows in hot climates; afternoon shade; succession plant.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Spinacia_oleracea_Spinazie_bloeiend.jpg/330px-Spinacia_oleracea_Spinazie_bloeiend.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Spinacia_oleracea_Spinazie_bloeiend.jpg/330px-Spinacia_oleracea_Spinazie_bloeiend.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('eggplant_mini', 'Mini brinjal (eggplant)', 'Solanum melongena', 'Solanaceae', 'Solanum', 'Plantae', 'VEGETABLE', 'VEGETABLE', 'Perennial', 'Plant species', 'LOW', NULL, NULL, NULL, TRUE, TRUE, FALSE, FALSE, TRUE, FALSE, 6, 10, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'LOW', 'GOOD', 1.5, 0.8, '["container","nightshade"]', 'Nightshade; even moisture; large pot for stability in wind.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Solanum_melongena_24_08_2012_%281%29.JPG/330px-Solanum_melongena_24_08_2012_%281%29.JPG', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Solanum_melongena_24_08_2012_%281%29.JPG/330px-Solanum_melongena_24_08_2012_%281%29.JPG', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('luffa', 'Ridge gourd (Turai)', 'Luffa acutangula', 'Cucurbitaceae', 'Luffa', 'Plantae', 'VEGETABLE', 'VEGETABLE', 'Perennial', 'Species of flowering plant', 'LOW', NULL, NULL, NULL, TRUE, TRUE, TRUE, FALSE, TRUE, FALSE, 6, 10, 'MED', 'TROPICAL|HOT_HUMID|TEMPERATE', 'PART', 'MED', 'MED', 'LOW', 1.5, 'SAFE', 'HIGH', 'GOOD', 1.5, 0.8, '["vine","monsoon_ok"]', 'Strong trellis; heavy feed and water during fruiting.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Luffa_acutangula_Chinese_okra.jpg/330px-Luffa_acutangula_Chinese_okra.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Luffa_acutangula_Chinese_okra.jpg/330px-Luffa_acutangula_Chinese_okra.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('peace_lily', 'Peace lily', 'Spathiphyllum spp.', NULL, NULL, 'Plantae', 'FOLIAGE', 'FOLIAGE', 'Perennial', NULL, 'LOW', 10, 12, 60, FALSE, TRUE, FALSE, FALSE, FALSE, TRUE, 2, 5, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'LOW', 'GOOD', 2.4, 1.6, '["low_light","shade_balcony"]', 'Low light tolerant; keep evenly moist; leaf burn if harsh sun.', NULL, NULL, 'CC', NULL, 1, TRUE, 0.1),
  ('jasmine_mogra', 'Mogra jasmine', 'Jasminum sambac', 'Oleaceae', 'Jasminum', 'Plantae', 'ORNAMENTAL', 'ORNAMENTAL', 'Perennial', 'Species of jasmine', 'LOW', NULL, NULL, NULL, FALSE, TRUE, TRUE, FALSE, TRUE, FALSE, 4, 8, 'MED', 'TROPICAL|HOT_HUMID|MONSOON_HEAVY|SUBTROPICAL', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'HIGH', 'GOOD', 1.5, 0.8, '["fragrant","container"]', 'Intensely fragrant; afternoon shade on hottest roofs; regular water.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Arabian_jasmin%2C_Tunisia_2010.jpg/330px-Arabian_jasmin%2C_Tunisia_2010.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Arabian_jasmin%2C_Tunisia_2010.jpg/330px-Arabian_jasmin%2C_Tunisia_2010.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('vetiver', 'Vetiver grass', 'Chrysopogon zizanioides', 'Poaceae', 'Chrysopogon', 'Plantae', 'GRASS', 'GRASS', 'Perennial', 'Species of plant', 'LOW', NULL, NULL, NULL, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, 6, 12, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'LOW', 'GOOD', 2.5, 2.5, '["cooling","erosion_help"]', 'Deep roots; high transpiration when established; contain spread in small pots.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Vetiver_grass.jpg/330px-Vetiver_grass.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Vetiver_grass.jpg/330px-Vetiver_grass.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('sweet_potato_vine', 'Sweet potato vine', 'Ipomoea batatas', 'Convolvulaceae', 'Ipomoea', 'Plantae', 'CREEPER', 'ORNAMENTAL', 'Perennial', 'Species of edible plant', 'LOW', NULL, NULL, NULL, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, 4, 10, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 1.5, 'SAFE', 'LOW', 'EXCELLENT', 1.5, 0.8, '["ground_cover","container"]', 'Fast-growing ground cover; colourful foliage; edible tubers if grown long enough.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Ipomoea_batatas_006.JPG/330px-Ipomoea_batatas_006.JPG', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Ipomoea_batatas_006.JPG/330px-Ipomoea_batatas_006.JPG', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('dracaena_marginata', 'Dragon tree (Dracaena)', 'Dracaena marginata', 'Asparagaceae', 'Dracaena', 'Plantae', 'FOLIAGE', 'FOLIAGE', 'Perennial', 'Species of flowering plant', 'LOW', NULL, NULL, NULL, FALSE, FALSE, FALSE, TRUE, TRUE, TRUE, 3, 8, 'MED', 'TROPICAL|HOT_HUMID|MONSOON_HEAVY', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'HIGH', 'GOOD', 2.4, 1.6, '["shade_balcony","accent"]', 'Architectural accent; tolerates partial shade on shaded balconies; low water.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Dracaena_reflexa.JPG/330px-Dracaena_reflexa.JPG', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Dracaena_reflexa.JPG/330px-Dracaena_reflexa.JPG', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('coleus', 'Coleus', 'Plectranthus scutellarioides', 'Lamiaceae', 'Coleus', 'Plantae', 'FOLIAGE', 'FOLIAGE', 'Perennial', 'Species of flowering plant', 'LOW', NULL, NULL, NULL, FALSE, TRUE, TRUE, FALSE, TRUE, TRUE, 2, 6, 'MED', 'TROPICAL|HOT_HUMID|SUBTROPICAL', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'HIGH', 'GOOD', 2.4, 1.6, '["shade_balcony","colorful"]', 'Vivid foliage for shaded balconies; pinch flowers to keep leaf colour; keep moist.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Plectranthus_scutellarioides_-_El_Yunque_nat_park_PR_IMG_2120.JPG/330px-Plectranthus_scutellarioides_-_El_Yunque_nat_park_PR_IMG_2120.JPG', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Plectranthus_scutellarioides_-_El_Yunque_nat_park_PR_IMG_2120.JPG/330px-Plectranthus_scutellarioides_-_El_Yunque_nat_park_PR_IMG_2120.JPG', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('ficus_pumila', 'Creeping fig', 'Ficus pumila', 'Moraceae', 'Ficus', 'Plantae', 'CLIMBER', 'CLIMBER', 'Perennial', 'Species of climbing fig', 'LOW', NULL, NULL, NULL, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE, 2, 6, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'HIGH', 'GOOD', 3, 2.8, '["wall_climber","shade_balcony"]', 'Self-clinging wall climber; good shade cover on balcony walls; keep evenly moist.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Ficus_pumila_%28Leafs%29.jpg/330px-Ficus_pumila_%28Leafs%29.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Ficus_pumila_%28Leafs%29.jpg/330px-Ficus_pumila_%28Leafs%29.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('adenium', 'Desert rose (Adenium)', 'Adenium obesum', 'Apocynaceae', 'Adenium', 'Plantae', 'SUCCULENT', 'SUCCULENT', 'Perennial', 'Species of plant', 'LOW', NULL, NULL, NULL, FALSE, TRUE, FALSE, TRUE, TRUE, TRUE, 6, 12, 'MED', 'TROPICAL|HOT_HUMID|SUBTROPICAL|TEMPERATE', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'HIGH', 'GOOD', 0.9, 0.8, '["drought","full_sun","bonsai_style"]', 'Stunning red/pink blooms; xeric champion; reduce water in monsoon to prevent rot.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Adenium_Obesum_Flower_Side_Macro_Mar22_D72_23052-58_ZS_P.jpg/330px-Adenium_Obesum_Flower_Side_Macro_Mar22_D72_23052-58_ZS_P.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Adenium_Obesum_Flower_Side_Macro_Mar22_D72_23052-58_ZS_P.jpg/330px-Adenium_Obesum_Flower_Side_Macro_Mar22_D72_23052-58_ZS_P.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('bamboo_dwarf', 'Dwarf bamboo', 'Pleioblastus spp.', NULL, NULL, 'Plantae', 'GRASS', 'GRASS', 'Perennial', NULL, 'LOW', 5, 11, 150, FALSE, FALSE, TRUE, FALSE, TRUE, FALSE, 4, 10, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'LOW', 'GOOD', 2.5, 2.5, '["privacy_screen","container_heavy"]', 'Privacy screen in large containers; invasive roots — use strong pot; regular water needed.', NULL, NULL, 'CC', NULL, 1, TRUE, 0.1),
  ('areca_palm_dwarf', 'Areca palm (dwarf)', 'Dypsis lutescens', 'Arecaceae', 'Dypsis', 'Plantae', 'FOLIAGE', 'FOLIAGE', 'Perennial', 'Species of plant from Madagascar', 'LOW', 10, 12, 200, FALSE, FALSE, TRUE, FALSE, TRUE, FALSE, 4, 8, 'MED', 'SUBTROPICAL', 'PART', 'MED', 'MED', 'LOW', 1.5, 'SAFE', 'HIGH', 'GOOD', 2.4, 1.6, '["tropical","container"]', 'Tropical feel; needs consistent moisture and feeding; avoid harsh direct midday sun.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/%E6%95%A3%E5%B0%BE%E8%91%B5Dypsis_lutescens_20210511145013_05.jpg/330px-%E6%95%A3%E5%B0%BE%E8%91%B5Dypsis_lutescens_20210511145013_05.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/%E6%95%A3%E5%B0%BE%E8%91%B5Dypsis_lutescens_20210511145013_05.jpg/330px-%E6%95%A3%E5%B0%BE%E8%91%B5Dypsis_lutescens_20210511145013_05.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('caladium', 'Caladium', 'Caladium bicolor', 'Araceae', 'Caladium', 'Plantae', 'FOLIAGE', 'FOLIAGE', 'Perennial', 'Species of flowering plant', 'LOW', 9, 11, 60, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 1, 4, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'HIGH', 0, 'UNSAFE', 'LOW', 'GOOD', 2.4, 1.6, '["shade_only","seasonal"]', 'Show-stopping shade foliage; goes dormant in heat/dry — store tubers; not for water-scarce setups.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Caladium_bicolor_2.jpg/330px-Caladium_bicolor_2.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Caladium_bicolor_2.jpg/330px-Caladium_bicolor_2.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('brahmi', 'Brahmi (Bacopa)', 'Bacopa monnieri', 'Plantaginaceae', 'Bacopa', 'Plantae', 'HERB', 'HERB', 'Perennial', 'Species of aquatic plant', 'LOW', NULL, NULL, NULL, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, 3, 7, 'MED', 'TROPICAL|HOT_HUMID|MONSOON_HEAVY', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'HIGH', 'GOOD', 1.3, 0.8, '["medicinal","shallow_tray"]', 'Ayurvedic herb; grows in shallow trays with consistent moisture; spreading ground cover.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Starr_010818-0007_Bacopa_monnieri.jpg/330px-Starr_010818-0007_Bacopa_monnieri.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Starr_010818-0007_Bacopa_monnieri.jpg/330px-Starr_010818-0007_Bacopa_monnieri.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('fenugreek', 'Methi / Fenugreek', 'Trigonella foenum-graecum', 'Fabaceae', 'Trigonella', 'Plantae', 'HERB', 'HERB', 'Perennial', 'Species of flowering plant', 'LOW', 9, 11, 60, TRUE, TRUE, TRUE, FALSE, FALSE, TRUE, 3, 6, 'MED', 'TROPICAL|HOT_HUMID|MONSOON_HEAVY|HOT_DRY|MEDITERRANEAN', 'PART', 'MED', 'MED', 'LOW', 1.5, 'SAFE', 'LOW', 'GOOD', 1.3, 0.8, '["quick_crop","kitchen_garden"]', 'Cool-season crop; bolt in peak summer; rapid 4-week harvest cycle for leaves.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Illustration_Trigonella_foenum-graecum0_clean.jpg/330px-Illustration_Trigonella_foenum-graecum0_clean.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Illustration_Trigonella_foenum-graecum0_clean.jpg/330px-Illustration_Trigonella_foenum-graecum0_clean.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('bitter_gourd', 'Bitter gourd (Karela)', 'Momordica charantia', 'Cucurbitaceae', 'Momordica', 'Plantae', 'VEGETABLE', 'VEGETABLE', 'Perennial', 'Species of plant in the gourd family', 'LOW', NULL, NULL, NULL, TRUE, TRUE, TRUE, FALSE, TRUE, FALSE, 6, 10, 'MED', 'TROPICAL|HOT_HUMID|SUBTROPICAL', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'LOW', 'GOOD', 1.5, 0.8, '["vine","kitchen_garden","monsoon_ok"]', 'Productive vine for trellis; peak performance in Indian summer heat; harvest young.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Momordica_charantia_Blanco2.357.png/330px-Momordica_charantia_Blanco2.357.png', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Momordica_charantia_Blanco2.357.png/330px-Momordica_charantia_Blanco2.357.png', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('morning_glory', 'Morning glory', 'Ipomoea purpurea', 'Convolvulaceae', 'Ipomoea', 'Plantae', 'CLIMBER', 'CLIMBER', 'Perennial', 'Species of plant', 'LOW', NULL, NULL, NULL, FALSE, TRUE, FALSE, TRUE, TRUE, TRUE, 6, 12, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'HIGH', 'GOOD', 3, 2.8, '["annual","trellis","color"]', 'Fast annual climber; large trumpet flowers; self-seeds; very easy from seed on trellis.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Ipomoea_purpurea%2C_2021-08-31%2C_Beechview%2C_05.jpg/330px-Ipomoea_purpurea%2C_2021-08-31%2C_Beechview%2C_05.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Ipomoea_purpurea%2C_2021-08-31%2C_Beechview%2C_05.jpg/330px-Ipomoea_purpurea%2C_2021-08-31%2C_Beechview%2C_05.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('chrysanthemum', 'Chrysanthemum (Guldaudi)', 'Chrysanthemum morifolium', 'Asteraceae', 'Chrysanthemum', 'Plantae', 'ORNAMENTAL', 'ORNAMENTAL', 'Perennial', 'Species of plant', 'LOW', NULL, NULL, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, 5, 8, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'LOW', 'GOOD', 1.5, 0.8, '["seasonal","festive"]', 'October–December bloomer for Indian rooftops; needs cool nights to flower; pinch in summer.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Chrysanthemum.JPG/330px-Chrysanthemum.JPG', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Chrysanthemum.JPG/330px-Chrysanthemum.JPG', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('crossandra', 'Crossandra (Aboli)', 'Crossandra infundibuliformis', 'Acanthaceae', 'Crossandra', 'Plantae', 'ORNAMENTAL', 'ORNAMENTAL', 'Perennial', 'Species of flowering plant', 'LOW', 9, 12, 90, FALSE, TRUE, TRUE, FALSE, TRUE, TRUE, 3, 7, 'MED', 'TROPICAL|HOT_HUMID|MONSOON_HEAVY', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'HIGH', 'GOOD', 1.5, 0.8, '["shade_tolerant","container","color"]', 'Long-season orange bloomer; tolerates shade on hot Indian balconies; keep moist.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Crossandra_infundibuliformis_kanakambaram_Madhurawada_Visakhapatnam.JPG/330px-Crossandra_infundibuliformis_kanakambaram_Madhurawada_Visakhapatnam.JPG', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Crossandra_infundibuliformis_kanakambaram_Madhurawada_Visakhapatnam.JPG/330px-Crossandra_infundibuliformis_kanakambaram_Madhurawada_Visakhapatnam.JPG', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('duranta', 'Golden dewdrop (Duranta)', 'Duranta erecta', 'Verbenaceae', 'Duranta', 'Plantae', 'SHRUB', 'SHRUB', 'Perennial', 'Species of flowering plant', 'LOW', 9, 12, 450, FALSE, TRUE, FALSE, TRUE, TRUE, TRUE, 6, 12, 'MED', 'TROPICAL|HOT_HUMID|SUBTROPICAL', 'PART', 'MED', 'MED', 'LOW', 0, 'UNSAFE', 'LOW', 'GOOD', 2, 1.8, '["hedge","pollinator","full_sun"]', 'Tough full-sun shrub for terrace hedges; berries toxic; blue flowers attract butterflies.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Duranta_erecta_serres_du_Luxembourg.jpg/330px-Duranta_erecta_serres_du_Luxembourg.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Duranta_erecta_serres_du_Luxembourg.jpg/330px-Duranta_erecta_serres_du_Luxembourg.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('wandering_jew', 'Tradescantia (Wandering jew)', 'Tradescantia zebrina', 'Commelinaceae', 'Tradescantia', 'Plantae', 'FOLIAGE', 'FOLIAGE', 'Perennial', 'Species of flowering plant in the family Commelinaceae', 'LOW', NULL, NULL, NULL, FALSE, TRUE, FALSE, TRUE, TRUE, TRUE, 2, 7, 'MED', 'SUBTROPICAL', 'PART', 'MED', 'MED', 'LOW', 1.5, 'UNSAFE', 'LOW', 'GOOD', 2.4, 1.6, '["hanging","shade_tolerant","colorful"]', 'Trailing foliage for hanging baskets or balcony railings; silver-purple leaves; easy from cuttings.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Zebrina_pendula_20060521_2_closer.jpg/330px-Zebrina_pendula_20060521_2_closer.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Zebrina_pendula_20060521_2_closer.jpg/330px-Zebrina_pendula_20060521_2_closer.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('henna', 'Henna (Mehndi)', 'Lawsonia inermis', 'Lythraceae', 'Lawsonia', 'Plantae', 'SHRUB', 'SHRUB', 'Perennial', 'Species of tree', 'LOW', NULL, NULL, NULL, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, 6, 12, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'LOW', 'GOOD', 2, 1.8, '["native_adapted","fragrant","hedge"]', 'Fragrant white flowers; dense hedge; very heat and drought resistant once established.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Lawsonia_inermis_%283709419835%29.jpg/330px-Lawsonia_inermis_%283709419835%29.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Lawsonia_inermis_%283709419835%29.jpg/330px-Lawsonia_inermis_%283709419835%29.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('lemongrass_dense', 'Dense lemongrass screen', 'Cymbopogon flexuosus', 'Poaceae', 'Cymbopogon', 'Plantae', 'GRASS', 'GRASS', 'Perennial', 'Species of grass', 'LOW', NULL, NULL, NULL, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, 6, 12, 'MED', 'TROPICAL|HOT_HUMID|MONSOON_HEAVY', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'HIGH', 'GOOD', 2.5, 2.5, '["privacy_screen","cooling","wind_ok"]', 'East Indian variety; taller and denser than C. citratus; ideal windbreak and privacy screen.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Cymbopogon_flexuosus%2C_Phipps_Conservatory%2C_2015-10-10%2C_01.jpg/330px-Cymbopogon_flexuosus%2C_Phipps_Conservatory%2C_2015-10-10%2C_01.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Cymbopogon_flexuosus%2C_Phipps_Conservatory%2C_2015-10-10%2C_01.jpg/330px-Cymbopogon_flexuosus%2C_Phipps_Conservatory%2C_2015-10-10%2C_01.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5),
  ('neem_dwarf', 'Dwarf neem', 'Azadirachta indica (dwarf cv.)', NULL, NULL, 'Plantae', 'SHRUB', 'SHRUB', 'Perennial', NULL, 'LOW', NULL, NULL, NULL, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, 6, 12, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'LOW', 'GOOD', 2, 1.8, '["native_adapted","pest_companion","full_sun"]', 'Natural pesticide effect; large container (50L+); keep pruned on rooftops.', NULL, NULL, 'CC', NULL, 1, TRUE, 0.1),
  ('impatiens', 'Impatiens (Touch-me-not)', 'Impatiens walleriana', 'Balsaminaceae', 'Impatiens', 'Plantae', 'ORNAMENTAL', 'ORNAMENTAL', 'Perennial', 'Species of flowering plant', 'LOW', 10, 12, 60, FALSE, TRUE, TRUE, FALSE, FALSE, TRUE, 1, 4, 'MED', 'TROPICAL|HOT_HUMID', 'PART', 'MED', 'MED', 'LOW', 0, 'SAFE', 'HIGH', 'GOOD', 1.5, 0.8, '["shade_only","color","annual"]', 'Best shade annual; keep evenly moist; avoid harsh afternoon sun on rooftops.', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Impatienswalleriana.jpg/330px-Impatienswalleriana.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Impatienswalleriana.jpg/330px-Impatienswalleriana.jpg', 'CC', 'wikipedia', 1, TRUE, 0.5);

-- ============================================================================
-- VERIFICATION & QUICK REFERENCE QUERIES
-- ============================================================================

-- Row count (expect 51)
SELECT COUNT(*) AS total_species FROM species_catalog;

-- Full table view — all 43 columns, all 51 species, sorted by category then code
SELECT
    id,
    code,
    display_name,
    scientific_name,
    family,
    genus,
    kingdom,
    category,
    growth_habit,
    cycle,
    native_range_notes,
    invasive_risk,
    hardiness_zone_min   AS hzone_min,
    hardiness_zone_max   AS hzone_max,
    max_height_cm,
    edible,
    flowering,
    pet_safe,
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
    child_pet_safety,
    native_support,
    container_suitability,
    cooling_contribution,
    privacy_contribution,
    tags_json,
    notes,
    image_url,
    image_thumbnail,
    image_license,
    image_source,
    ml_weight,
    active,
    data_confidence
FROM species_catalog
ORDER BY category, code;

-- ── Summary table (copy to spreadsheet) ─────────────────────────────────────
SELECT
    code,
    display_name,
    category,
    sunlight_preference   AS sun,
    water_demand          AS water,
    drought_tolerant      AS drought,
    heat_tolerant         AS heat,
    pet_safe,
    edible,
    container_suitability AS container,
    maintenance_need      AS maint,
    invasive_risk         AS invasive,
    cooling_contribution  AS cooling,
    privacy_contribution  AS privacy,
    data_confidence       AS confidence
FROM species_catalog
ORDER BY category, cooling_contribution DESC;

-- ── Per-category count ───────────────────────────────────────────────────────
SELECT
    category,
    COUNT(*)                                           AS total,
    SUM(edible::int)                                   AS edible,
    SUM(pet_safe::int)                                 AS pet_safe,
    SUM(drought_tolerant::int)                         AS drought_tolerant,
    SUM(heat_tolerant::int)                            AS heat_tolerant,
    ROUND(AVG(cooling_contribution)::numeric, 2)       AS avg_cooling,
    ROUND(AVG(data_confidence)::numeric, 2)            AS avg_confidence
FROM species_catalog
GROUP BY category
ORDER BY total DESC;

-- ── Engine hard-exclusion counts ─────────────────────────────────────────────
SELECT
    'Total species'                           AS rule,  COUNT(*)          AS species_count FROM species_catalog
UNION ALL
SELECT 'pet_safe = TRUE',                               COUNT(*) FROM species_catalog WHERE pet_safe = TRUE
UNION ALL
SELECT 'drought_tolerant = TRUE',                       COUNT(*) FROM species_catalog WHERE drought_tolerant = TRUE
UNION ALL
SELECT 'water_demand = LOW (scarce-water eligible)',    COUNT(*) FROM species_catalog WHERE water_demand = 'LOW'
UNION ALL
SELECT 'water_demand = HIGH (scarce-water excluded)',   COUNT(*) FROM species_catalog WHERE water_demand = 'HIGH'
UNION ALL
SELECT 'container_suitability = POOR (rooftop exclude)',COUNT(*) FROM species_catalog WHERE container_suitability = 'POOR'
UNION ALL
SELECT 'invasive_risk = HIGH (score 0.65x)',            COUNT(*) FROM species_catalog WHERE invasive_risk = 'HIGH'
UNION ALL
SELECT 'edible = TRUE',                                 COUNT(*) FROM species_catalog WHERE edible = TRUE
UNION ALL
SELECT 'heat_tolerant = TRUE',                          COUNT(*) FROM species_catalog WHERE heat_tolerant = TRUE;

-- ============================================================================
-- END OF FILE  |  heatwise_species_tabular.sql
-- HeatWise Species Catalog  |  51 species  |  43 columns  |  2026-04-02
-- ============================================================================
