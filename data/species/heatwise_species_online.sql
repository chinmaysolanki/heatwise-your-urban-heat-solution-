-- ============================================================
-- HeatWise Species Catalog  |  SQLite  |  Online SQL Compiler
-- ============================================================
-- Paste into: https://sqliteonline.com  then click [Run]
-- Also works: https://www.db-fiddle.com (select SQLite)
--             https://onecompiler.com/sqlite
--
-- CONTENTS
--   Section 1 : Engine constants table (97 rows)
--   Section 2 : Species catalog table  (53 columns)
--   Section 3 : INSERT data            (51 species)
--   Section 4 : Query 1  - Full catalog (all 53 cols)
--   Section 5 : Query 2  - Quick scan  (20 cols)
--   Section 6 : Query 3  - Hard exclusion eligibility matrix
--   Section 7 : Query 4  - Score breakdown (4 components + blend)
--   Section 8 : Query 5  - Category summary
--   Section 9 : Query 6  - Rule coverage counts
--   Section 10: Query 7A - Scenario: Mumbai full-sun extreme-heat scarce-water pet-safe
--   Section 11: Query 7B - Scenario: Shaded balcony edible garden pet-safe
--   Section 12: Query 7C - Scenario: Hot-arid severe-wind
--   Section 13: Query 7D - Scenario: Standard rooftop unfiltered ranking
--   Section 14: Query 8  - ML training feature export
--   Section 15: Query 9  - Engine constants reference
--
-- ============================================================
-- ENGINE HARD-EXCLUSION RULES (applied before scoring)
-- ============================================================
-- R1  shadeSunMismatchHardExclude
--       Exclude if: site=SHADE and species sun_pref=FULL
--                   OR species min_sun_hours > (site_hours + 0.75)
--
-- R2  waterScarcityHardExclude
--       Exclude if: water_demand=HIGH
--                   OR water_demand=MED and drought_tolerant=0
--
-- R3  petSafetyHardExclude
--       Exclude if: child_pet_safety=UNSAFE or CAUTION (when pet gate on)
--
-- R4  indoorFullSunHardExclude
--       Exclude if: space=indoor and (sun_pref=FULL or min_sun_hours >= 6)
--
-- R5  extremeHeatHardExclude
--       Exclude if: site temp >= 38C and heat_tolerant=0
--
-- R6  severeWindHardExclude
--       Exclude if: is_climber=1
--                   OR (wind_tolerance=LOW and drought_tolerant=0)
--
-- R7  highRiseHeavyGreeningExclude
--       Exclude if: floor > 15 and load=low and maintenance=HIGH
--
-- R8  loadCapacityExclude
--       Exclude if: load_capacity=low and greenery_density=high
--
-- R9  budgetExceededExclude
--       Exclude if: install_cost > budget * 1.25
--
-- ============================================================
-- SCORING MULTIPLIERS
-- ============================================================
-- Sun match (species pref x site bucket):
--   FULL  x FULL  = 1.00  FULL  x PART  = 0.78  FULL  x SHADE = 0.00
--   PART  x FULL  = 0.82  PART  x PART  = 1.00  PART  x SHADE = 0.82
--   SHADE x FULL  = 0.55  SHADE x PART  = 0.82  SHADE x SHADE = 1.00
--   BOTH  x any   = 1.00  unknown       = 0.75
--
-- Container: EXCELLENT=0.95  GOOD=0.86  MODERATE=0.72  POOR=0.55
-- Water stress (no access): HIGH=0.45  MED=0.72  LOW=0.92
-- Maintenance gap penalty: 1.0 - (|user_tier - species_tier| * 0.22)
-- ML weight: max(0.35, min(1.2, 0.85 + ml_weight * 0.05))
--
-- Scarce water scenario factor:
--   LOW demand + drought_tolerant=1 -> 1.30x
--   LOW demand only                 -> 1.12x
--   MED demand + drought_tolerant=1 -> 0.90x
--   Showy ornamental                -> 0.58x further
--
-- Extreme heat (site >= 38C):
--   heat_tolerant=1 and drought_tolerant=1 -> 1.28x bonus
--   heat_tolerant=0                         -> 0.62x penalty
--
-- High heat (33-37.9C):
--   heat_tolerant=1 and drought_tolerant=1 -> 1.12x bonus
--   heat_tolerant=0                         -> 0.80x penalty
--
-- Severe wind (>= 50 km/h), adapted (wind_tolerance=HIGH, drought=1, low_maint=1):
--   Adapted species -> 1.22x bonus
--   Non-adapted     -> 0.70x penalty
--
-- Hot-arid xeric alignment:
--   Full align (xeric=1 + drought + cooling>=2.5 + heat ok) -> 1.34x
--   Partial align                                            -> 1.12x
--   Weak (not drought or cooling<1.5)                       -> 0.72x
--
-- COMPOSITE FORMULA (equal 0.25 blend weights)
--   rule_prior  = 0.28 + sun*0.28 + maint_gap*0.18 + water*0.18 + edible_fit*edible_w
--   heat_score  = (min(1, cooling/3.2 + heat_bonus) * 0.92) + sun*0.08
--   ranking     = (pollinator*0.20 + native*0.16 + edible_fit*edible_w2 + sun*0.17) * ml_w
--   feasibility = container_score * maint_gap * 0.92 + water*0.08
--   blended     = (rule_prior + heat_score + ranking + feasibility) / 4.0
--   clamped to  [0.06, 1.0]
-- ============================================================

DROP TABLE IF EXISTS rule_constants;
DROP TABLE IF EXISTS species_catalog;

-- ============================================================
-- Section 1: Engine constants (97 thresholds and multipliers)
-- ============================================================
CREATE TABLE rule_constants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_code   TEXT NOT NULL,
  constant    TEXT NOT NULL,
  value       REAL NOT NULL,
  description TEXT NOT NULL
);

INSERT INTO rule_constants (rule_code, constant, value, description) VALUES
('BLEND','weight_rule_prior',0.25,'Blend weight for rulePrior component'),
('BLEND','weight_feasibility',0.25,'Blend weight for feasibility component'),
('BLEND','weight_heat',0.25,'Blend weight for heat component'),
('BLEND','weight_ranking',0.25,'Blend weight for ranking component'),
('BLEND','score_floor',0.06,'Minimum allowed blended score'),
('BLEND','score_ceiling',1.00,'Maximum allowed blended score'),
('RULE_PRIOR','sun_weight',0.28,'Sun match weight in rule_prior'),
('RULE_PRIOR','maint_weight',0.18,'Maintenance gap weight in rule_prior'),
('RULE_PRIOR','water_weight',0.18,'Water stress weight in rule_prior'),
('RULE_PRIOR','edible_weight_food',0.14,'Edible fit weight when goal=food'),
('RULE_PRIOR','edible_weight_other',0.08,'Edible fit weight other goals'),
('HEAT','cooling_divisor',3.20,'Divisor normalising cooling to heat score'),
('HEAT','heat_tolerant_bonus',0.12,'Added to heat core when heat_tolerant=1'),
('HEAT','heat_component_sun_weight',0.08,'Sun sub-weight inside heat component'),
('RANKING','pollinator_weight',0.20,'Pollinator norm weight in ranking'),
('RANKING','native_weight',0.16,'Native fit score weight in ranking'),
('RANKING','sun_weight',0.17,'Sun match weight in ranking'),
('RANKING','edible_weight_food',0.50,'Edible fit weight in ranking for food goal'),
('RANKING','edible_weight_other',0.35,'Edible fit weight in ranking other goals'),
('RANKING','pollinator_raw_divisor',3.50,'Raw pollinator / this = pollinator_norm'),
('RANKING','pollinator_default_raw',2.00,'Default raw pollinator when not set'),
('FEASIBILITY','container_weight',0.92,'Container score weight in feasibility'),
('FEASIBILITY','water_weight',0.08,'Water stress weight in feasibility'),
('SUN','full_x_full',1.00,'Species FULL on FULL site'),
('SUN','full_x_part',0.78,'Species FULL on PART site'),
('SUN','full_x_shade',0.00,'Species FULL on SHADE site - hard exclude'),
('SUN','part_x_full',0.82,'Species PART on FULL site'),
('SUN','part_x_part',1.00,'Species PART on PART site'),
('SUN','part_x_shade',0.82,'Species PART on SHADE site'),
('SUN','shade_x_full',0.55,'Species SHADE on FULL site'),
('SUN','shade_x_part',0.82,'Species SHADE on PART site'),
('SUN','shade_x_shade',1.00,'Species SHADE on SHADE site'),
('SUN','both_x_any',1.00,'Species BOTH - matches any site'),
('SUN','unknown_default',0.75,'Default when sun preference unknown'),
('SUN','site_full_hours',8.00,'Sun hours for FULL site'),
('SUN','site_part_hours',5.00,'Sun hours for PART site'),
('SUN','site_shade_hours',2.50,'Sun hours for SHADE site'),
('SUN','shade_threshold',3.50,'Hours at or below this -> SHADE site'),
('SUN','full_threshold',7.00,'Hours at or above this -> FULL site'),
('SUN','mismatch_tolerance',0.75,'Buffer before sun mismatch fires'),
('CONTAINER','excellent',0.95,'Container score for EXCELLENT'),
('CONTAINER','good',0.86,'Container score for GOOD'),
('CONTAINER','moderate',0.72,'Container score for MODERATE'),
('CONTAINER','poor',0.55,'Container score for POOR'),
('WATER_STRESS','high_demand',0.45,'No-water-access multiplier for HIGH demand'),
('WATER_STRESS','med_demand',0.72,'No-water-access multiplier for MED demand'),
('WATER_STRESS','low_demand',0.92,'No-water-access multiplier for LOW demand'),
('MAINT','gap_scale',0.22,'Per-tier gap penalty coefficient'),
('MAINT','tier_low',0,'Tier value for LOW maintenance'),
('MAINT','tier_med',1,'Tier value for MED maintenance'),
('MAINT','tier_high',2,'Tier value for HIGH maintenance'),
('ML','weight_base',0.85,'Base offset for ml_weight calculation'),
('ML','weight_scale',0.05,'Per-point scale for ml_weight'),
('ML','weight_min',0.35,'Floor for computed ML weight'),
('ML','weight_max',1.20,'Ceiling for computed ML weight'),
('NATIVE','high',1.00,'Native fit score HIGH'),
('NATIVE','med',0.88,'Native fit score MED'),
('NATIVE','low',0.75,'Native fit score LOW or unknown'),
('EDIBLE','fit_edible_food',1.00,'Edible species for food goal'),
('EDIBLE','fit_non_edible_food',0.10,'Non-edible for food goal'),
('EDIBLE','fit_unknown_food',0.22,'Unknown edibility for food goal'),
('EDIBLE','fit_other_goals',0.78,'Any species for non-food goal'),
('SCENARIO_WATER','scarce_low_drought',1.30,'Scarce: LOW demand + drought ok'),
('SCENARIO_WATER','scarce_low_only',1.12,'Scarce: LOW demand only'),
('SCENARIO_WATER','scarce_med_drought',0.90,'Scarce: MED demand + drought ok'),
('SCENARIO_WATER','scarce_showy_penalty',0.58,'Scarce: showy full-sun ornamental penalty'),
('SCENARIO_WATER','scarce_med_showy',0.71,'Scarce: MED-water showy ornamental'),
('SCENARIO_HEAT','extreme_bonus_rule',1.28,'Extreme heat bonus: rule_prior + heat'),
('SCENARIO_HEAT','extreme_bonus_rank',1.18,'Extreme heat bonus: ranking'),
('SCENARIO_HEAT','high_bonus_rule',1.12,'High heat bonus: rule_prior + heat'),
('SCENARIO_HEAT','high_bonus_rank',1.08,'High heat bonus: ranking'),
('SCENARIO_HEAT','extreme_penalty',0.62,'Extreme heat penalty: not heat tolerant'),
('SCENARIO_HEAT','high_penalty',0.80,'High heat penalty: not heat tolerant'),
('SCENARIO_WIND','severe_bonus',1.22,'Severe wind: adapted species bonus'),
('SCENARIO_WIND','windy_bonus',1.08,'Windy: adapted species bonus'),
('SCENARIO_WIND','severe_penalty',0.70,'Severe wind: fragile species penalty'),
('SCENARIO_WIND','windy_penalty',0.84,'Windy: fragile species penalty'),
('SCENARIO_XERIC','full_align',1.34,'Hot-arid full alignment multiplier'),
('SCENARIO_XERIC','partial_align',1.12,'Hot-arid partial alignment multiplier'),
('SCENARIO_XERIC','weak',0.72,'Hot-arid weak fit penalty'),
('SCENARIO_XERIC','showy_penalty',0.76,'Hot-arid showy ornamental penalty'),
('SCENARIO_INDOOR','rank_boost',1.18,'Indoor shade+compact ranking boost'),
('SCENARIO_INDOOR','rule_boost',1.10,'Indoor shade+compact rule_prior boost'),
('SCENARIO_PET','large_maint_penalty',0.80,'Pet-safe: large high-maint poor-container'),
('SCENARIO_PET','high_maint_penalty',0.88,'Pet-safe: high-maint non-edible'),
('SCENARIO_PET','low_maint_edible_bonus',1.08,'Pet-safe: low-maint edible bonus'),
('THRESHOLD','extreme_heat_c',38.0,'Degrees C for extreme heat'),
('THRESHOLD','high_heat_c',33.0,'Degrees C for high heat'),
('THRESHOLD','severe_wind_kmh',50.0,'km/h for severe wind'),
('THRESHOLD','windy_kmh',30.0,'km/h for windy'),
('THRESHOLD','high_rise_floor',15.0,'Floor level for high-rise rules'),
('THRESHOLD','budget_overrun',1.25,'Cost fraction triggering budget exclude'),
('THRESHOLD','showy_min_pollinator',3.0,'Min pollinator raw value for showy label'),
('THRESHOLD','showy_min_cooling',2.8,'Min cooling value for showy label'),
('INVASIVE','high_multiplier',0.65,'Score multiplier for HIGH invasive risk'),
('INVASIVE','moderate_multiplier',0.85,'Score multiplier for MODERATE invasive risk');

-- ============================================================
-- Section 2: Species catalog table (53 columns)
-- ============================================================
CREATE TABLE species_catalog (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  -- IDENTITY
  code                TEXT NOT NULL UNIQUE,
  display_name        TEXT NOT NULL,
  scientific_name     TEXT NOT NULL DEFAULT '',
  family              TEXT NOT NULL DEFAULT '',
  genus               TEXT NOT NULL DEFAULT '',
  kingdom             TEXT NOT NULL DEFAULT 'Plantae',
  -- CLASSIFICATION
  category            TEXT NOT NULL,
  growth_habit        TEXT NOT NULL DEFAULT '',
  cycle               TEXT NOT NULL DEFAULT '',
  native_range_notes  TEXT DEFAULT '',
  invasive_risk       TEXT NOT NULL DEFAULT 'LOW',
  -- SIZE
  hardiness_zone_min  INTEGER,
  hardiness_zone_max  INTEGER,
  max_height_cm       REAL,
  -- BOOLEAN TRAITS
  edible              INTEGER NOT NULL DEFAULT 0,
  flowering           INTEGER NOT NULL DEFAULT 0,
  pet_safe            INTEGER NOT NULL DEFAULT 0,
  drought_tolerant    INTEGER NOT NULL DEFAULT 0,
  heat_tolerant       INTEGER NOT NULL DEFAULT 0,
  low_maintenance     INTEGER NOT NULL DEFAULT 0,
  -- SUN HOURS
  min_sun_hours       REAL NOT NULL DEFAULT 4,
  max_sun_hours       REAL NOT NULL DEFAULT 8,
  -- VOCABULARY SCORES
  drought_tolerance     TEXT NOT NULL DEFAULT 'MED',
  climate_suitability   TEXT NOT NULL DEFAULT '',
  sunlight_preference   TEXT NOT NULL DEFAULT 'PART',
  water_demand          TEXT NOT NULL DEFAULT 'MED',
  maintenance_need      TEXT NOT NULL DEFAULT 'MED',
  root_aggressiveness   TEXT NOT NULL DEFAULT 'LOW',
  -- ECOSYSTEM
  pollinator_value      REAL NOT NULL DEFAULT 0,
  child_pet_safety      TEXT NOT NULL DEFAULT 'SAFE',
  native_support        TEXT NOT NULL DEFAULT 'LOW',
  container_suitability TEXT NOT NULL DEFAULT 'GOOD',
  -- CONTINUOUS SCORES
  cooling_contribution  REAL NOT NULL DEFAULT 0,
  privacy_contribution  REAL NOT NULL DEFAULT 0,
  -- EXTENDED ENGINE SIGNALS
  wind_tolerance        TEXT NOT NULL DEFAULT 'MODERATE',
  indoor_suitable       INTEGER NOT NULL DEFAULT 0,
  is_climber            INTEGER NOT NULL DEFAULT 0,
  xeric_adapted         INTEGER NOT NULL DEFAULT 0,
  container_score_num   REAL NOT NULL DEFAULT 0.86,
  maint_tier            INTEGER NOT NULL DEFAULT 1,
  pollinator_norm       REAL NOT NULL DEFAULT 0,
  native_fit_score      REAL NOT NULL DEFAULT 0.75,
  showy_ornamental      INTEGER NOT NULL DEFAULT 0,
  -- CONTENT
  tags_json             TEXT NOT NULL DEFAULT '[]',
  notes                 TEXT DEFAULT '',
  -- IMAGE
  image_url             TEXT DEFAULT '',
  image_thumbnail       TEXT DEFAULT '',
  image_license         TEXT DEFAULT 'CC',
  image_source          TEXT DEFAULT 'wikipedia',
  -- ML / SYSTEM
  ml_weight             REAL NOT NULL DEFAULT 1.0,
  active                INTEGER NOT NULL DEFAULT 1,
  data_confidence       REAL NOT NULL DEFAULT 0.5
);

-- ============================================================
-- Section 3: INSERT data (51 species, all 53 columns filled)
-- ============================================================
INSERT INTO species_catalog (
  code, display_name, scientific_name, family, genus, kingdom,
  category, growth_habit, cycle, native_range_notes, invasive_risk,
  hardiness_zone_min, hardiness_zone_max, max_height_cm,
  edible, flowering, pet_safe, drought_tolerant, heat_tolerant, low_maintenance,
  min_sun_hours, max_sun_hours,
  drought_tolerance, climate_suitability, sunlight_preference,
  water_demand, maintenance_need, root_aggressiveness,
  pollinator_value, child_pet_safety, native_support, container_suitability,
  cooling_contribution, privacy_contribution,
  wind_tolerance, indoor_suitable, is_climber, xeric_adapted,
  container_score_num, maint_tier, pollinator_norm, native_fit_score, showy_ornamental,
  tags_json, notes, image_url, image_thumbnail, image_license, image_source,
  ml_weight, active, data_confidence
) VALUES
('tulsi_holy','Holy basil (Tulsi)','Ocimum tenuiflorum','Lamiaceae','Ocimum','Plantae','HERB','HERB','Perennial','Species of flowering plant','LOW',10,12,60,1,1,1,1,1,1,4,10,'MED','TROPICAL|HOT_HUMID|SUBTROPICAL','PART','MED','MED','LOW',0.5,'SAFE','HIGH','GOOD',1.3,0.8,'MODERATE',0,0,0,0.86,1,0.14,1.0,0,'["native_adapted","aromatic","pollinator"]','India staple; handles heat; pinch flowers for leaf production.','https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Tulsi_or_Tulasi_Holy_basil.jpg/330px-Tulsi_or_Tulasi_Holy_basil.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Tulsi_or_Tulasi_Holy_basil.jpg/330px-Tulsi_or_Tulasi_Holy_basil.jpg','CC','wikipedia',1,1,0.5),
('basil_sweet','Sweet basil','Ocimum basilicum','Lamiaceae','Ocimum','Plantae','HERB','HERB','Perennial','Culinary herb','LOW',10,11,50,1,1,1,0,1,1,4,8,'MED','TROPICAL|HOT_HUMID|SUBTROPICAL|TEMPERATE','PART','MED','MED','LOW',0,'SAFE','HIGH','GOOD',1.3,0.8,'LOW',0,0,0,0.86,1,0.0,1.0,0,'["container","monsoon_ok"]','Bolts in extreme heatafternoon shade helps; water consistently.','https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Ocimum_basilicum_8zz.jpg/330px-Ocimum_basilicum_8zz.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Ocimum_basilicum_8zz.jpg/330px-Ocimum_basilicum_8zz.jpg','CC','wikipedia',1,1,0.5),
('mint','Mint','Mentha spp.','Lamiaceae','Mentha','Plantae','HERB','HERB','Perennial','','LOW',3,11,60,1,1,1,0,1,1,3,6,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'SAFE','LOW','GOOD',1.3,0.8,'LOW',1,0,0,0.86,1,0.14,0.75,0,'["container","moist_soil"]','Use deep pot; invasive rootsisolate. Part sun on hot roofs.','','','CC','',1,1,0.1),
('coriander','Coriander (Cilantro)','Coriandrum sativum','Apiaceae','Coriandrum','Plantae','HERB','HERB','Perennial','Annual herb','LOW',3,11,50,1,1,1,0,0,1,3,5,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'SAFE','LOW','GOOD',1.3,0.8,'LOW',0,0,0,0.86,1,0.0,0.75,0,'["quick_crop","shade_afternoon"]','Sow in cooler windows; bolt risk in peak summersuccession plant.','https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Coriandrum_sativum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-193.jpg/330px-Coriandrum_sativum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-193.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Coriandrum_sativum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-193.jpg/330px-Coriandrum_sativum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-193.jpg','CC','wikipedia',1,1,0.5),
('curry_leaf','Curry leaf tree (Kadi patta)','Murraya koenigii','Rutaceae','Murraya','Plantae','HERB','HERB','Perennial','Species of flowering plant','LOW',9,12,150,1,1,0,1,1,1,6,10,'MED','TROPICAL|HOT_HUMID|MONSOON_HEAVY|SUBTROPICAL','PART','MED','MED','LOW',1.5,'UNSAFE','HIGH','GOOD',1.3,0.8,'MODERATE',0,0,0,0.86,1,0.43,1.0,0,'["perennial_pot","wind_ok"]','Large container; protect roots from waterlogging in monsoon.','https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Curry_Trees.jpg/330px-Curry_Trees.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Curry_Trees.jpg/330px-Curry_Trees.jpg','CC','wikipedia',1,1,0.5),
('lemongrass','Lemongrass','Cymbopogon citratus','Poaceae','Cymbopogon','Plantae','HERB','HERB','Perennial','Species of plant','LOW',8,11,180,1,0,1,1,1,1,6,10,'MED','TROPICAL|HOT_HUMID|MONSOON_HEAVY','PART','MED','MED','LOW',0,'SAFE','HIGH','GOOD',1.3,0.8,'HIGH',0,0,0,0.86,1,0.0,1.0,0,'["container","privacy_screen"]','Excellent heat performer; divide clumps yearly in pots.','https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gardenology.org-IMG_2892_rbgs11jan.jpg/330px-Gardenology.org-IMG_2892_rbgs11jan.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gardenology.org-IMG_2892_rbgs11jan.jpg/330px-Gardenology.org-IMG_2892_rbgs11jan.jpg','CC','wikipedia',1,1,0.5),
('cherry_tomato','Cherry tomato','Solanum lycopersicum','Solanaceae','Solanum','Plantae','VEGETABLE','VEGETABLE','Perennial','Edible berry','LOW',2,11,120,1,1,0,0,1,0,6,10,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',1.5,'UNSAFE','LOW','EXCELLENT',1.5,0.8,'LOW',0,0,0,0.95,1,0.43,0.75,0,'["vegetable","staking"]','Deep pot + mulch; blossom drop if nights stay too warmtry heat-set types.','https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Tomato_je.jpg/330px-Tomato_je.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Tomato_je.jpg/330px-Tomato_je.jpg','CC','wikipedia',1,1,0.5),
('chilli','Chilli pepper','Capsicum annuum','Solanaceae','Capsicum','Plantae','VEGETABLE','VEGETABLE','Perennial','Species of flowering plant in the nightshade family','LOW',NULL,NULL,NULL,1,1,0,1,1,1,6,10,'MED','TEMPERATE','PART','MED','MED','LOW',1.5,'UNSAFE','HIGH','GOOD',1.5,0.8,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["productive","container"]','Very rooftop-friendly in India; watch thrips in dry season.','https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Capsicum_annuum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-027.jpg/330px-Capsicum_annuum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-027.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Capsicum_annuum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-027.jpg/330px-Capsicum_annuum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-027.jpg','CC','wikipedia',1,1,0.5),
('malabar_spinach','Malabar spinach','Basella alba','Basellaceae','Basella','Plantae','VEGETABLE','VEGETABLE','Perennial','Species of edible plant','LOW',NULL,NULL,NULL,1,1,1,0,1,1,4,8,'MED','TROPICAL|HOT_HUMID|MONSOON_HEAVY','PART','MED','MED','LOW',0,'SAFE','LOW','GOOD',1.5,0.8,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["climber","monsoon_ok"]','Vining leafy green for hot weatherbetter than true spinach in heat.','https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Basella_alba-2.JPG/330px-Basella_alba-2.JPG','https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Basella_alba-2.JPG/330px-Basella_alba-2.JPG','CC','wikipedia',1,1,0.5),
('aloe_vera','Aloe vera','Aloe barbadensis miller','Asphodelaceae','Aloe','Plantae','SUCCULENT','SUCCULENT','Perennial','','LOW',8,11,60,0,1,0,1,1,1,4,10,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'UNSAFE','LOW','GOOD',0.9,0.8,'MODERATE',1,0,1,0.86,0,0.0,0.75,0,'["succulent","medicinal_lookalike_caution"]','Roof workhorse; avoid overwatering in humid monsoon.','','','CC','',1,1,0.1),
('jade_plant','Jade plant','Crassula ovata','Crassulaceae','Crassula','Plantae','SUCCULENT','SUCCULENT','Perennial','Species of succulent','LOW',10,12,90,0,1,0,1,1,1,4,8,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'UNSAFE','HIGH','GOOD',0.9,0.8,'MODERATE',1,0,1,0.86,0,0.0,1.0,0,'["succulent","wind_ok"]','Slow; afternoon shade on very hot roofs reduces leaf scorch.','https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Crassula_ovata_700.jpg/330px-Crassula_ovata_700.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Crassula_ovata_700.jpg/330px-Crassula_ovata_700.jpg','CC','wikipedia',1,1,0.5),
('sedum','Sedum (stonecrop)','Sedum spp.','Crassulaceae','Sedum','Plantae','SUCCULENT','SUCCULENT','Perennial','','LOW',3,9,30,0,1,1,1,1,1,6,12,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'SAFE','LOW','GOOD',0.9,0.8,'HIGH',0,0,1,0.86,0,0.0,0.75,0,'["green_roof","drought"]','Green roof / shallow tray candidate; sharp drainage.','','','CC','',1,1,0.1),
('prickly_pear','Prickly pear cactus','Opuntia spp.','Cactaceae','Opuntia','Plantae','SUCCULENT','SUCCULENT','Perennial','','LOW',3,11,150,1,1,0,1,1,1,8,12,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'UNSAFE','LOW','GOOD',0.9,0.8,'HIGH',0,0,1,0.86,0,0.0,0.75,0,'["cactus","full_sun"]','Extreme heat/drought; pad handling and spinespets/kids.','','','CC','',1,1,0.1),
('bougainvillea','Bougainvillea','Bougainvillea spp.','Nyctaginaceae','Bougainvillea','Plantae','ORNAMENTAL','ORNAMENTAL','Perennial','','LOW',9,11,900,0,1,0,1,1,1,8,12,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'UNSAFE','LOW','GOOD',1.5,0.8,'HIGH',0,1,1,0.86,1,0.0,0.75,1,'["climber","color"]','Classic Indian terrace; large pot + trellis; sharp thorns.','','','CC','',1,1,0.1),
('hibiscus','Chinese hibiscus','Hibiscus rosa-sinensis','Malvaceae','Hibiscus','Plantae','ORNAMENTAL','ORNAMENTAL','Perennial','Hybrid species of flowering plant','LOW',9,12,400,0,1,0,0,1,0,6,10,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'UNSAFE','LOW','GOOD',1.5,0.8,'MODERATE',0,0,0,0.86,1,0.43,0.75,1,'["flowering_shrub","container"]','Needs water in heat; watch for aphids; great tropical roof vibe.','https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Hibiscus_Brilliant.jpg/330px-Hibiscus_Brilliant.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Hibiscus_Brilliant.jpg/330px-Hibiscus_Brilliant.jpg','CC','wikipedia',1,1,0.5),
('marigold','Marigold (Genda)','Tagetes spp.','Asteraceae','Tagetes','Plantae','ORNAMENTAL','ORNAMENTAL','Perennial','','LOW',2,11,90,1,1,1,1,1,1,6,10,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'SAFE','LOW','GOOD',1.5,0.8,'MODERATE',0,0,1,0.86,0,0.0,0.75,1,'["annual","pest_companion"]','Companion plant; tolerates poor soil; easy from seed.','','','CC','',1,1,0.1),
('portulaca','Portulaca (moss rose)','Portulaca grandiflora','Portulacaceae','Portulaca','Plantae','ORNAMENTAL','ORNAMENTAL','Perennial','Rose-like flowering plant','LOW',10,12,20,0,1,1,1,1,1,6,12,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'SAFE','HIGH','GOOD',1.5,0.8,'MODERATE',0,0,1,0.86,0,0.0,1.0,1,'["annual","shallow_root"]','Trailing color for shallow planters; loves sun and heat.','https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/PortulacaGrandiflora.jpg/330px-PortulacaGrandiflora.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/PortulacaGrandiflora.jpg/330px-PortulacaGrandiflora.jpg','CC','wikipedia',1,1,0.5),
('vinca','Periwinkle (Vinca)','Catharanthus roseus','Apocynaceae','Catharanthus','Plantae','ORNAMENTAL','ORNAMENTAL','Perennial','Species of flowering plant in the family Apocynaceae','LOW',10,12,60,0,1,0,1,1,1,4,10,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'UNSAFE','HIGH','GOOD',1.5,0.8,'MODERATE',0,0,1,0.86,0,0.0,1.0,1,'["annual","container"]','Heat-tolerant color; toxic if ingestedkeep from pets.','https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Catharanthus_roseus_%28Pink_Madagascar_Periwinkle%29.jpg/330px-Catharanthus_roseus_%28Pink_Madagascar_Periwinkle%29.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Catharanthus_roseus_%28Pink_Madagascar_Periwinkle%29.jpg/330px-Catharanthus_roseus_%28Pink_Madagascar_Periwinkle%29.jpg','CC','wikipedia',1,1,0.5),
('zinnia','Zinnia','Zinnia elegans','Asteraceae','Zinnia','Plantae','ORNAMENTAL','ORNAMENTAL','Perennial','Species of flowering plant','LOW',NULL,NULL,NULL,1,1,1,1,1,1,6,12,'MED','SUBTROPICAL','PART','MED','MED','LOW',0,'SAFE','HIGH','GOOD',1.5,0.8,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["annual","pollinator"]','Cut-and-come-again; excellent for hot balconies.','https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Zinnienbl%C3%BCte_Zinnia_elegans_stack15_20190722-RM-7222254.jpg/330px-Zinnienbl%C3%BCte_Zinnia_elegans_stack15_20190722-RM-7222254.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Zinnienbl%C3%BCte_Zinnia_elegans_stack15_20190722-RM-7222254.jpg/330px-Zinnienbl%C3%BCte_Zinnia_elegans_stack15_20190722-RM-7222254.jpg','CC','wikipedia',1,1,0.5),
('pothos','Money plant (Pothos)','Epipremnum aureum','Araceae','Epipremnum','Plantae','FOLIAGE','FOLIAGE','Perennial','Species of plant','LOW',10,12,200,0,0,0,1,1,1,2,6,'MED','TROPICAL|HOT_HUMID|MONSOON_HEAVY|SUBTROPICAL|TEMPERATE','PART','MED','MED','LOW',0,'UNSAFE','HIGH','EXCELLENT',2.4,1.6,'LOW',1,1,0,0.95,0,0.0,1.0,0,'["shade_balcony","hanging"]','Bright indirect on hot balconies; avoid direct noon sun.','https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Money_Plant_%28Epipremnum_aureum%29_4.jpg/330px-Money_Plant_%28Epipremnum_aureum%29_4.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Money_Plant_%28Epipremnum_aureum%29_4.jpg/330px-Money_Plant_%28Epipremnum_aureum%29_4.jpg','CC','wikipedia',1,1,0.5),
('snake_plant','Snake plant','Dracaena trifasciata','Asparagaceae','Dracaena','Plantae','FOLIAGE','FOLIAGE','Perennial','Species of flowering plant','LOW',9,12,90,0,1,0,1,1,1,2,8,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'UNSAFE','HIGH','GOOD',2.4,1.6,'MODERATE',1,0,1,0.86,0,0.0,1.0,0,'["low_light_roof_corner","wind_ok"]','Tolerates AC-adjacent semi-shade corners; rot if overwatered.','https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Snake_Plant_%28Sansevieria_trifasciata_%27Laurentii%27%29.jpg/330px-Snake_Plant_%28Sansevieria_trifasciata_%27Laurentii%27%29.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Snake_Plant_%28Sansevieria_trifasciata_%27Laurentii%27%29.jpg/330px-Snake_Plant_%28Sansevieria_trifasciata_%27Laurentii%27%29.jpg','CC','wikipedia',1,1,0.5),
('spider_plant','Spider plant','Chlorophytum comosum','Asparagaceae','Chlorophytum','Plantae','FOLIAGE','FOLIAGE','Perennial','Species of flowering plant','LOW',9,11,60,0,1,1,0,1,1,3,6,'MED','TROPICAL|HOT_HUMID|MONSOON_HEAVY|SUBTROPICAL','PART','MED','MED','LOW',0,'SAFE','HIGH','GOOD',2.4,1.6,'MODERATE',1,0,0,0.86,0,0.0,1.0,0,'["hanging","shade_balcony"]','Part shade on terraces; brown tips if scorched or salty water.','https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Hierbabuena_0611_Revised.jpg/330px-Hierbabuena_0611_Revised.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Hierbabuena_0611_Revised.jpg/330px-Hierbabuena_0611_Revised.jpg','CC','wikipedia',1,1,0.5),
('geranium_pelargonium','Scented geranium','Pelargonium spp.','Geraniaceae','Pelargonium','Plantae','ORNAMENTAL','ORNAMENTAL','Perennial','','LOW',9,12,60,1,1,0,1,1,1,6,10,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'UNSAFE','LOW','GOOD',1.5,0.8,'MODERATE',1,0,1,0.86,1,0.0,0.75,1,'["container","aromatic"]','Good in pots; some scents deter mosquitoes (mild effect).','','','CC','',1,1,0.1),
('plumeria','Plumeria (Frangipani)','Plumeria spp.','Apocynaceae','Plumeria','Plantae','ORNAMENTAL','ORNAMENTAL','Perennial','','LOW',9,12,800,0,1,0,1,1,1,8,12,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'UNSAFE','LOW','GOOD',1.5,0.8,'LOW',0,0,1,0.72,1,0.0,0.75,1,'["tropical","fragrant"]','Large container; deciduous; protect from waterlogging.','','','CC','',1,1,0.1),
('okra','Okra (Bhindi)','Abelmoschus esculentus','Malvaceae','Abelmoschus','Plantae','VEGETABLE','VEGETABLE','Perennial','Species of edible plant','LOW',8,12,200,1,1,1,0,1,0,6,10,'MED','TROPICAL|HOT_HUMID|SUBTROPICAL|TEMPERATE','PART','MED','MED','LOW',0,'SAFE','HIGH','GOOD',1.5,0.8,'MODERATE',0,0,0,0.86,1,0.43,1.0,0,'["kitchen_garden","monsoon_ok"]','Heat-loving pod crop; deep pot; harvest young pods regularly.','https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Hong_Kong_Okra_Aug_25_2012.JPG/330px-Hong_Kong_Okra_Aug_25_2012.JPG','https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Hong_Kong_Okra_Aug_25_2012.JPG/330px-Hong_Kong_Okra_Aug_25_2012.JPG','CC','wikipedia',1,1,0.5),
('spinach_indian','Indian spinach (Palak)','Spinacia oleracea','Amaranthaceae','Spinacia','Plantae','HERB','HERB','Perennial','Species of flowering plant','LOW',NULL,NULL,NULL,1,0,1,0,0,0,3,6,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'SAFE','HIGH','GOOD',1.3,0.8,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["quick_crop","shade_afternoon"]','Cool-season windows in hot climates; afternoon shade; succession plant.','https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Spinacia_oleracea_Spinazie_bloeiend.jpg/330px-Spinacia_oleracea_Spinazie_bloeiend.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Spinacia_oleracea_Spinazie_bloeiend.jpg/330px-Spinacia_oleracea_Spinazie_bloeiend.jpg','CC','wikipedia',1,1,0.5),
('eggplant_mini','Mini brinjal (eggplant)','Solanum melongena','Solanaceae','Solanum','Plantae','VEGETABLE','VEGETABLE','Perennial','Plant species','LOW',NULL,NULL,NULL,1,1,0,0,1,0,6,10,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'UNSAFE','LOW','GOOD',1.5,0.8,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["container","nightshade"]','Nightshade; even moisture; large pot for stability in wind.','https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Solanum_melongena_24_08_2012_%281%29.JPG/330px-Solanum_melongena_24_08_2012_%281%29.JPG','https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Solanum_melongena_24_08_2012_%281%29.JPG/330px-Solanum_melongena_24_08_2012_%281%29.JPG','CC','wikipedia',1,1,0.5),
('luffa','Ridge gourd (Turai)','Luffa acutangula','Cucurbitaceae','Luffa','Plantae','VEGETABLE','VEGETABLE','Perennial','Species of flowering plant','LOW',NULL,NULL,NULL,1,1,1,0,1,0,6,10,'MED','TROPICAL|HOT_HUMID|TEMPERATE','PART','MED','MED','LOW',1.5,'SAFE','HIGH','GOOD',1.5,0.8,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["vine","monsoon_ok"]','Strong trellis; heavy feed and water during fruiting.','https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Luffa_acutangula_Chinese_okra.jpg/330px-Luffa_acutangula_Chinese_okra.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Luffa_acutangula_Chinese_okra.jpg/330px-Luffa_acutangula_Chinese_okra.jpg','CC','wikipedia',1,1,0.5),
('peace_lily','Peace lily','Spathiphyllum spp.','Araceae','Spathiphyllum','Plantae','FOLIAGE','FOLIAGE','Perennial','','LOW',10,12,60,0,1,0,0,0,1,2,5,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'UNSAFE','LOW','GOOD',2.4,1.6,'LOW',1,0,0,0.86,1,0.0,0.75,0,'["low_light","shade_balcony"]','Low light tolerant; keep evenly moist; leaf burn if harsh sun.','','','CC','',1,1,0.1),
('jasmine_mogra','Mogra jasmine','Jasminum sambac','Oleaceae','Jasminum','Plantae','ORNAMENTAL','ORNAMENTAL','Perennial','Species of jasmine','LOW',NULL,NULL,NULL,0,1,1,0,1,0,4,8,'MED','TROPICAL|HOT_HUMID|MONSOON_HEAVY|SUBTROPICAL','PART','MED','MED','LOW',0,'SAFE','HIGH','GOOD',1.5,0.8,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["fragrant","container"]','Intensely fragrant; afternoon shade on hottest roofs; regular water.','https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Arabian_jasmin%2C_Tunisia_2010.jpg/330px-Arabian_jasmin%2C_Tunisia_2010.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Arabian_jasmin%2C_Tunisia_2010.jpg/330px-Arabian_jasmin%2C_Tunisia_2010.jpg','CC','wikipedia',1,1,0.5),
('vetiver','Vetiver grass','Chrysopogon zizanioides','Poaceae','Chrysopogon','Plantae','GRASS','GRASS','Perennial','Species of plant','LOW',NULL,NULL,NULL,0,1,1,1,1,1,6,12,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'SAFE','LOW','GOOD',2.5,2.5,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["cooling","erosion_help"]','Deep roots; high transpiration when established; contain spread in small pots.','https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Vetiver_grass.jpg/330px-Vetiver_grass.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Vetiver_grass.jpg/330px-Vetiver_grass.jpg','CC','wikipedia',1,1,0.5),
('sweet_potato_vine','Sweet potato vine','Ipomoea batatas','Convolvulaceae','Ipomoea','Plantae','CREEPER','ORNAMENTAL','Perennial','Species of edible plant','LOW',NULL,NULL,NULL,1,0,1,1,1,1,4,10,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',1.5,'SAFE','LOW','EXCELLENT',1.5,0.8,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["ground_cover","container"]','Fast-growing ground cover; colourful foliage; edible tubers if grown long enough.','https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Ipomoea_batatas_006.JPG/330px-Ipomoea_batatas_006.JPG','https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Ipomoea_batatas_006.JPG/330px-Ipomoea_batatas_006.JPG','CC','wikipedia',1,1,0.5),
('dracaena_marginata','Dragon tree (Dracaena)','Dracaena marginata','Asparagaceae','Dracaena','Plantae','FOLIAGE','FOLIAGE','Perennial','Species of flowering plant','LOW',NULL,NULL,NULL,0,0,0,1,1,1,3,8,'MED','TROPICAL|HOT_HUMID|MONSOON_HEAVY','PART','MED','MED','LOW',0,'UNSAFE','HIGH','GOOD',2.4,1.6,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["shade_balcony","accent"]','Architectural accent; tolerates partial shade on shaded balconies; low water.','https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Dracaena_reflexa.JPG/330px-Dracaena_reflexa.JPG','https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Dracaena_reflexa.JPG/330px-Dracaena_reflexa.JPG','CC','wikipedia',1,1,0.5),
('coleus','Coleus','Plectranthus scutellarioides','Lamiaceae','Coleus','Plantae','FOLIAGE','FOLIAGE','Perennial','Species of flowering plant','LOW',NULL,NULL,NULL,0,1,1,0,1,1,2,6,'MED','TROPICAL|HOT_HUMID|SUBTROPICAL','PART','MED','MED','LOW',0,'SAFE','HIGH','GOOD',2.4,1.6,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["shade_balcony","colorful"]','Vivid foliage for shaded balconies; pinch flowers to keep leaf colour; keep moist.','https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Plectranthus_scutellarioides_-_El_Yunque_nat_park_PR_IMG_2120.JPG/330px-Plectranthus_scutellarioides_-_El_Yunque_nat_park_PR_IMG_2120.JPG','https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Plectranthus_scutellarioides_-_El_Yunque_nat_park_PR_IMG_2120.JPG/330px-Plectranthus_scutellarioides_-_El_Yunque_nat_park_PR_IMG_2120.JPG','CC','wikipedia',1,1,0.5),
('ficus_pumila','Creeping fig','Ficus pumila','Moraceae','Ficus','Plantae','CLIMBER','CLIMBER','Perennial','Species of climbing fig','LOW',NULL,NULL,NULL,0,0,0,0,1,1,2,6,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'UNSAFE','HIGH','GOOD',3,2.8,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["wall_climber","shade_balcony"]','Self-clinging wall climber; good shade cover on balcony walls; keep evenly moist.','https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Ficus_pumila_%28Leafs%29.jpg/330px-Ficus_pumila_%28Leafs%29.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Ficus_pumila_%28Leafs%29.jpg/330px-Ficus_pumila_%28Leafs%29.jpg','CC','wikipedia',1,1,0.5),
('adenium','Desert rose (Adenium)','Adenium obesum','Apocynaceae','Adenium','Plantae','SUCCULENT','SUCCULENT','Perennial','Species of plant','LOW',NULL,NULL,NULL,0,1,0,1,1,1,6,12,'MED','TROPICAL|HOT_HUMID|SUBTROPICAL|TEMPERATE','PART','MED','MED','LOW',0,'UNSAFE','HIGH','GOOD',0.9,0.8,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["drought","full_sun","bonsai_style"]','Stunning red/pink blooms; xeric champion; reduce water in monsoon to prevent rot.','https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Adenium_Obesum_Flower_Side_Macro_Mar22_D72_23052-58_ZS_P.jpg/330px-Adenium_Obesum_Flower_Side_Macro_Mar22_D72_23052-58_ZS_P.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Adenium_Obesum_Flower_Side_Macro_Mar22_D72_23052-58_ZS_P.jpg/330px-Adenium_Obesum_Flower_Side_Macro_Mar22_D72_23052-58_ZS_P.jpg','CC','wikipedia',1,1,0.5),
('bamboo_dwarf','Dwarf bamboo','Pleioblastus spp.','Poaceae','Pleioblastus','Plantae','GRASS','GRASS','Perennial','','LOW',5,11,150,0,0,1,0,1,0,4,10,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'SAFE','LOW','GOOD',2.5,2.5,'HIGH',0,0,0,0.86,1,0.0,0.75,0,'["privacy_screen","container_heavy"]','Privacy screen in large containers; invasive roots  use strong pot; regular water needed.','','','CC','',1,1,0.1),
('areca_palm_dwarf','Areca palm (dwarf)','Dypsis lutescens','Arecaceae','Dypsis','Plantae','FOLIAGE','FOLIAGE','Perennial','Species of plant from Madagascar','LOW',10,12,200,0,0,1,0,1,0,4,8,'MED','SUBTROPICAL','PART','MED','MED','LOW',1.5,'SAFE','HIGH','GOOD',2.4,1.6,'LOW',1,0,0,0.86,1,0.43,1.0,0,'["tropical","container"]','Tropical feel; needs consistent moisture and feeding; avoid harsh direct midday sun.','https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/%E6%95%A3%E5%B0%BE%E8%91%B5Dypsis_lutescens_20210511145013_05.jpg/330px-%E6%95%A3%E5%B0%BE%E8%91%B5Dypsis_lutescens_20210511145013_05.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/%E6%95%A3%E5%B0%BE%E8%91%B5Dypsis_lutescens_20210511145013_05.jpg/330px-%E6%95%A3%E5%B0%BE%E8%91%B5Dypsis_lutescens_20210511145013_05.jpg','CC','wikipedia',1,1,0.5),
('caladium','Caladium','Caladium bicolor','Araceae','Caladium','Plantae','FOLIAGE','FOLIAGE','Perennial','Species of flowering plant','LOW',9,11,60,0,0,0,0,0,0,1,4,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','HIGH',0,'UNSAFE','LOW','GOOD',2.4,1.6,'LOW',1,0,0,0.86,2,0.0,0.75,0,'["shade_only","seasonal"]','Show-stopping shade foliage; goes dormant in heat/dry  store tubers; not for water-scarce setups.','https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Caladium_bicolor_2.jpg/330px-Caladium_bicolor_2.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Caladium_bicolor_2.jpg/330px-Caladium_bicolor_2.jpg','CC','wikipedia',1,1,0.5),
('brahmi','Brahmi (Bacopa)','Bacopa monnieri','Plantaginaceae','Bacopa','Plantae','HERB','HERB','Perennial','Species of aquatic plant','LOW',NULL,NULL,NULL,1,1,1,0,1,1,3,7,'MED','TROPICAL|HOT_HUMID|MONSOON_HEAVY','PART','MED','MED','LOW',0,'SAFE','HIGH','GOOD',1.3,0.8,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["medicinal","shallow_tray"]','Ayurvedic herb; grows in shallow trays with consistent moisture; spreading ground cover.','https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Starr_010818-0007_Bacopa_monnieri.jpg/330px-Starr_010818-0007_Bacopa_monnieri.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Starr_010818-0007_Bacopa_monnieri.jpg/330px-Starr_010818-0007_Bacopa_monnieri.jpg','CC','wikipedia',1,1,0.5),
('fenugreek','Methi / Fenugreek','Trigonella foenum-graecum','Fabaceae','Trigonella','Plantae','HERB','HERB','Perennial','Species of flowering plant','LOW',9,11,60,1,1,1,0,0,1,3,6,'MED','TROPICAL|HOT_HUMID|MONSOON_HEAVY|HOT_DRY|MEDITERRANEAN','PART','MED','MED','LOW',1.5,'SAFE','LOW','GOOD',1.3,0.8,'LOW',0,0,0,0.86,1,0.43,0.75,0,'["quick_crop","kitchen_garden"]','Cool-season crop; bolt in peak summer; rapid 4-week harvest cycle for leaves.','https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Illustration_Trigonella_foenum-graecum0_clean.jpg/330px-Illustration_Trigonella_foenum-graecum0_clean.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Illustration_Trigonella_foenum-graecum0_clean.jpg/330px-Illustration_Trigonella_foenum-graecum0_clean.jpg','CC','wikipedia',1,1,0.5),
('bitter_gourd','Bitter gourd (Karela)','Momordica charantia','Cucurbitaceae','Momordica','Plantae','VEGETABLE','VEGETABLE','Perennial','Species of plant in the gourd family','LOW',NULL,NULL,NULL,1,1,1,0,1,0,6,10,'MED','TROPICAL|HOT_HUMID|SUBTROPICAL','PART','MED','MED','LOW',0,'SAFE','LOW','GOOD',1.5,0.8,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["vine","kitchen_garden","monsoon_ok"]','Productive vine for trellis; peak performance in Indian summer heat; harvest young.','https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Momordica_charantia_Blanco2.357.png/330px-Momordica_charantia_Blanco2.357.png','https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Momordica_charantia_Blanco2.357.png/330px-Momordica_charantia_Blanco2.357.png','CC','wikipedia',1,1,0.5),
('morning_glory','Morning glory','Ipomoea purpurea','Convolvulaceae','Ipomoea','Plantae','CLIMBER','CLIMBER','Perennial','Species of plant','LOW',NULL,NULL,NULL,0,1,0,1,1,1,6,12,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'UNSAFE','HIGH','GOOD',3,2.8,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["annual","trellis","color"]','Fast annual climber; large trumpet flowers; self-seeds; very easy from seed on trellis.','https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Ipomoea_purpurea%2C_2021-08-31%2C_Beechview%2C_05.jpg/330px-Ipomoea_purpurea%2C_2021-08-31%2C_Beechview%2C_05.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Ipomoea_purpurea%2C_2021-08-31%2C_Beechview%2C_05.jpg/330px-Ipomoea_purpurea%2C_2021-08-31%2C_Beechview%2C_05.jpg','CC','wikipedia',1,1,0.5),
('chrysanthemum','Chrysanthemum (Guldaudi)','Chrysanthemum morifolium','Asteraceae','Chrysanthemum','Plantae','ORNAMENTAL','ORNAMENTAL','Perennial','Species of plant','LOW',NULL,NULL,NULL,0,1,0,0,0,0,5,8,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'UNSAFE','LOW','GOOD',1.5,0.8,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["seasonal","festive"]','OctoberDecember bloomer for Indian rooftops; needs cool nights to flower; pinch in summer.','https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Chrysanthemum.JPG/330px-Chrysanthemum.JPG','https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Chrysanthemum.JPG/330px-Chrysanthemum.JPG','CC','wikipedia',1,1,0.5),
('crossandra','Crossandra (Aboli)','Crossandra infundibuliformis','Acanthaceae','Crossandra','Plantae','ORNAMENTAL','ORNAMENTAL','Perennial','Species of flowering plant','LOW',9,12,90,0,1,1,0,1,1,3,7,'MED','TROPICAL|HOT_HUMID|MONSOON_HEAVY','PART','MED','MED','LOW',0,'SAFE','HIGH','GOOD',1.5,0.8,'LOW',0,0,0,0.86,1,0.0,1.0,1,'["shade_tolerant","container","color"]','Long-season orange bloomer; tolerates shade on hot Indian balconies; keep moist.','https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Crossandra_infundibuliformis_kanakambaram_Madhurawada_Visakhapatnam.JPG/330px-Crossandra_infundibuliformis_kanakambaram_Madhurawada_Visakhapatnam.JPG','https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Crossandra_infundibuliformis_kanakambaram_Madhurawada_Visakhapatnam.JPG/330px-Crossandra_infundibuliformis_kanakambaram_Madhurawada_Visakhapatnam.JPG','CC','wikipedia',1,1,0.5),
('duranta','Golden dewdrop (Duranta)','Duranta erecta','Verbenaceae','Duranta','Plantae','SHRUB','SHRUB','Perennial','Species of flowering plant','LOW',9,12,450,0,1,0,1,1,1,6,12,'MED','TROPICAL|HOT_HUMID|SUBTROPICAL','PART','MED','MED','LOW',0,'UNSAFE','LOW','GOOD',2,1.8,'HIGH',0,0,1,0.86,0,0.43,0.75,1,'["hedge","pollinator","full_sun"]','Tough full-sun shrub for terrace hedges; berries toxic; blue flowers attract butterflies.','https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Duranta_erecta_serres_du_Luxembourg.jpg/330px-Duranta_erecta_serres_du_Luxembourg.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Duranta_erecta_serres_du_Luxembourg.jpg/330px-Duranta_erecta_serres_du_Luxembourg.jpg','CC','wikipedia',1,1,0.5),
('wandering_jew','Tradescantia (Wandering jew)','Tradescantia zebrina','Commelinaceae','Tradescantia','Plantae','FOLIAGE','FOLIAGE','Perennial','Species of flowering plant in the family Commelinaceae','LOW',NULL,NULL,NULL,0,1,0,1,1,1,2,7,'MED','SUBTROPICAL','PART','MED','MED','LOW',1.5,'UNSAFE','LOW','GOOD',2.4,1.6,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["hanging","shade_tolerant","colorful"]','Trailing foliage for hanging baskets or balcony railings; silver-purple leaves; easy from cuttings.','https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Zebrina_pendula_20060521_2_closer.jpg/330px-Zebrina_pendula_20060521_2_closer.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Zebrina_pendula_20060521_2_closer.jpg/330px-Zebrina_pendula_20060521_2_closer.jpg','CC','wikipedia',1,1,0.5),
('henna','Henna (Mehndi)','Lawsonia inermis','Lythraceae','Lawsonia','Plantae','SHRUB','SHRUB','Perennial','Species of tree','LOW',NULL,NULL,NULL,0,1,1,1,1,1,6,12,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'SAFE','LOW','GOOD',2,1.8,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["native_adapted","fragrant","hedge"]','Fragrant white flowers; dense hedge; very heat and drought resistant once established.','https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Lawsonia_inermis_%283709419835%29.jpg/330px-Lawsonia_inermis_%283709419835%29.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Lawsonia_inermis_%283709419835%29.jpg/330px-Lawsonia_inermis_%283709419835%29.jpg','CC','wikipedia',1,1,0.5),
('lemongrass_dense','Dense lemongrass screen','Cymbopogon flexuosus','Poaceae','Cymbopogon','Plantae','GRASS','GRASS','Perennial','Species of grass','LOW',NULL,NULL,NULL,1,0,1,1,1,1,6,12,'MED','TROPICAL|HOT_HUMID|MONSOON_HEAVY','PART','MED','MED','LOW',0,'SAFE','HIGH','GOOD',2.5,2.5,'MODERATE',0,0,0,0.86,1,0.0,0.75,0,'["privacy_screen","cooling","wind_ok"]','East Indian variety; taller and denser than C. citratus; ideal windbreak and privacy screen.','https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Cymbopogon_flexuosus%2C_Phipps_Conservatory%2C_2015-10-10%2C_01.jpg/330px-Cymbopogon_flexuosus%2C_Phipps_Conservatory%2C_2015-10-10%2C_01.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Cymbopogon_flexuosus%2C_Phipps_Conservatory%2C_2015-10-10%2C_01.jpg/330px-Cymbopogon_flexuosus%2C_Phipps_Conservatory%2C_2015-10-10%2C_01.jpg','CC','wikipedia',1,1,0.5),
('neem_dwarf','Dwarf neem','Azadirachta indica (dwarf cv.)','Meliaceae','Azadirachta','Plantae','SHRUB','SHRUB','Perennial','','LOW',10,12,400,0,1,1,1,1,1,6,12,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'SAFE','LOW','GOOD',2,1.8,'HIGH',0,0,1,0.86,1,0.0,0.75,0,'["native_adapted","pest_companion","full_sun"]','Natural pesticide effect; large container (50L+); keep pruned on rooftops.','','','CC','',1,1,0.1),
('impatiens','Impatiens (Touch-me-not)','Impatiens walleriana','Balsaminaceae','Impatiens','Plantae','ORNAMENTAL','ORNAMENTAL','Perennial','Species of flowering plant','LOW',10,12,60,0,1,1,0,0,1,1,4,'MED','TROPICAL|HOT_HUMID','PART','MED','MED','LOW',0,'SAFE','HIGH','GOOD',1.5,0.8,'LOW',1,0,0,0.86,1,0.0,1.0,1,'["shade_only","color","annual"]','Best shade annual; keep evenly moist; avoid harsh afternoon sun on rooftops.','https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Impatienswalleriana.jpg/330px-Impatienswalleriana.jpg','https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Impatienswalleriana.jpg/330px-Impatienswalleriana.jpg','CC','wikipedia',1,1,0.5);

-- ============================================================
-- Section 4: Query 1 - Full catalog (all 53 columns)
-- ============================================================
SELECT id, code, display_name, scientific_name, family, genus, category,
  cycle, invasive_risk,
  hardiness_zone_min AS hz_min, hardiness_zone_max AS hz_max,
  max_height_cm AS height_cm,
  edible, flowering, pet_safe, drought_tolerant, heat_tolerant, low_maintenance,
  min_sun_hours, max_sun_hours,
  drought_tolerance, climate_suitability,
  sunlight_preference AS sun, water_demand,
  maintenance_need AS maint, root_aggressiveness AS root,
  ROUND(pollinator_value,2) AS pollinator,
  child_pet_safety, native_support,
  container_suitability AS container,
  ROUND(cooling_contribution,1) AS cooling,
  ROUND(privacy_contribution,1) AS privacy,
  wind_tolerance AS wind,
  indoor_suitable, is_climber, xeric_adapted,
  container_score_num AS cs, maint_tier,
  ROUND(pollinator_norm,3) AS poll_norm,
  ROUND(native_fit_score,2) AS nat_fit,
  showy_ornamental AS showy,
  ml_weight, active, ROUND(data_confidence,2) AS conf,
  tags_json, notes
FROM species_catalog
ORDER BY category, cooling_contribution DESC;

-- ============================================================
-- Section 5: Query 2 - Quick scan (20 key columns)
-- ============================================================
SELECT
  id, code, display_name, category,
  sunlight_preference AS sun,
  water_demand,
  CASE drought_tolerant  WHEN 1 THEN 'YES' ELSE '-'  END AS drought,
  CASE heat_tolerant     WHEN 1 THEN 'YES' ELSE '-'  END AS heat,
  CASE pet_safe          WHEN 1 THEN 'YES' ELSE 'NO' END AS pet_safe,
  child_pet_safety,
  CASE edible            WHEN 1 THEN 'YES' ELSE '-'  END AS edible,
  container_suitability AS container,
  maintenance_need AS maint,
  wind_tolerance AS wind,
  CASE is_climber        WHEN 1 THEN 'YES' ELSE '-'  END AS climber,
  CASE indoor_suitable   WHEN 1 THEN 'YES' ELSE '-'  END AS indoor,
  invasive_risk AS invasive,
  ROUND(cooling_contribution,1) AS cooling,
  max_height_cm AS height_cm,
  ROUND(data_confidence,2) AS conf
FROM species_catalog
ORDER BY category, cooling_contribution DESC;

-- ============================================================
-- Section 6: Query 3 - Hard exclusion eligibility matrix
-- ============================================================
SELECT
  code, display_name, category,
  CASE WHEN sunlight_preference IN ('FULL','BOTH')
       THEN 'PASS' ELSE 'FAIL'
  END AS r1_full_sun_site,
  CASE WHEN sunlight_preference IN ('SHADE','PART','BOTH')
       THEN 'PASS' ELSE 'FAIL'
  END AS r1_shade_site,
  CASE
    WHEN water_demand = 'LOW' AND drought_tolerant = 1 THEN 'PASS priority-1.30x'
    WHEN water_demand = 'LOW'                          THEN 'PASS 1.12x'
    WHEN water_demand = 'MED' AND drought_tolerant = 1 THEN 'PASS 0.90x'
    WHEN water_demand = 'HIGH'                         THEN 'FAIL high-demand'
    ELSE                                                    'FAIL no-drought-info'
  END AS r2_scarce_water,
  CASE child_pet_safety
    WHEN 'SAFE'    THEN 'PASS'
    WHEN 'CAUTION' THEN 'FAIL caution'
    WHEN 'UNSAFE'  THEN 'FAIL unsafe'
    ELSE 'FAIL unknown'
  END AS r3_pet_safety,
  CASE
    WHEN indoor_suitable = 1 AND sunlight_preference != 'FULL' THEN 'PASS indoor-ok'
    WHEN sunlight_preference = 'FULL' OR min_sun_hours >= 6    THEN 'FAIL too-sunny'
    ELSE 'POSSIBLE'
  END AS r4_indoor,
  CASE WHEN heat_tolerant = 1 THEN 'PASS' ELSE 'FAIL' END AS r5_extreme_heat,
  CASE
    WHEN is_climber = 1                                                  THEN 'FAIL climber'
    WHEN wind_tolerance = 'HIGH' AND drought_tolerant = 1
         AND low_maintenance = 1                                          THEN 'PASS bonus-1.22x'
    WHEN wind_tolerance = 'HIGH'                                         THEN 'PASS'
    WHEN wind_tolerance = 'MODERATE'                                     THEN 'PENALTY 0.84x'
    ELSE                                                                       'FAIL fragile'
  END AS r6_severe_wind,
  CASE invasive_risk
    WHEN 'HIGH'     THEN '0.65x penalty'
    WHEN 'MODERATE' THEN '0.85x penalty'
    ELSE 'none'
  END AS invasive_multiplier,
  ROUND(cooling_contribution,1) AS cooling
FROM species_catalog
ORDER BY category, cooling_contribution DESC;

-- ============================================================
-- Section 7: Query 4 - Composite score breakdown
-- Session: PART sun | water access ok | user maint=MED | goal=other
-- ============================================================
WITH scored AS (
  SELECT
    code, display_name, category, cooling_contribution,
    maint_tier, container_score_num, pollinator_norm,
    native_fit_score, ml_weight, heat_tolerant,
    sunlight_preference,
    -- sun match score for PART site
    CASE sunlight_preference
      WHEN 'FULL'  THEN 0.82
      WHEN 'PART'  THEN 1.00
      WHEN 'SHADE' THEN 0.82
      WHEN 'BOTH'  THEN 1.00
      ELSE 0.75
    END AS sun_s,
    -- maintenance gap (user tier = 1)
    (1.0 - MIN(1.0, ABS(maint_tier - 1) * 0.22)) AS maint_gap,
    -- ml weight computed
    MAX(0.35, MIN(1.2, 0.85 + ml_weight * 0.05)) AS ml_w
  FROM species_catalog
  WHERE active = 1
)
SELECT
  code, display_name, category,
  ROUND(sun_s, 2)      AS sun_score,
  ROUND(maint_gap, 3)  AS maint_gap,
  -- rule_prior
  ROUND(MIN(1.0, MAX(0.06,
    0.28 + sun_s*0.28 + maint_gap*0.18 + 1.0*0.18 + 0.78*0.08
  )), 4) AS rule_prior,
  -- heat score
  ROUND(MIN(1.0, MAX(0.06,
    MIN(1.0, cooling_contribution/3.2 + CASE WHEN heat_tolerant=1 THEN 0.12 ELSE 0.0 END)
    * 0.92 + sun_s * 0.08
  )), 4) AS heat_score,
  -- ranking score
  ROUND(MIN(1.0, MAX(0.06,
    (pollinator_norm*0.20 + native_fit_score*0.16 + 0.78*0.35 + sun_s*0.17) * ml_w
  )), 4) AS ranking_score,
  -- feasibility score
  ROUND(MIN(1.0, MAX(0.06,
    container_score_num * maint_gap * 0.92 + 1.0 * 0.08
  )), 4) AS feasibility_score,
  -- blended final score
  ROUND(MIN(1.0, MAX(0.06,
    (MIN(1.0, MAX(0.06, 0.28 + sun_s*0.28 + maint_gap*0.18 + 1.0*0.18 + 0.78*0.08)) * 0.25)
    + (MIN(1.0, MAX(0.06, MIN(1.0, cooling_contribution/3.2 + CASE WHEN heat_tolerant=1 THEN 0.12 ELSE 0.0 END) * 0.92 + sun_s*0.08)) * 0.25)
    + (MIN(1.0, MAX(0.06, (pollinator_norm*0.20 + native_fit_score*0.16 + 0.78*0.35 + sun_s*0.17) * ml_w)) * 0.25)
    + (MIN(1.0, MAX(0.06, container_score_num * maint_gap * 0.92 + 1.0*0.08)) * 0.25)
  )), 4) AS blended_score,
  ROUND(cooling_contribution,1) AS cooling
FROM scored
ORDER BY blended_score DESC;

-- ============================================================
-- Section 8: Query 5 - Category summary
-- ============================================================
SELECT
  category,
  COUNT(*)                              AS species,
  SUM(edible)                           AS edible,
  SUM(pet_safe)                         AS pet_safe,
  SUM(drought_tolerant)                 AS drought_tol,
  SUM(heat_tolerant)                    AS heat_tol,
  SUM(low_maintenance)                  AS low_maint,
  SUM(is_climber)                       AS climbers,
  SUM(indoor_suitable)                  AS indoor_ok,
  SUM(xeric_adapted)                    AS xeric,
  SUM(showy_ornamental)                 AS showy,
  ROUND(AVG(cooling_contribution),2)    AS avg_cooling,
  ROUND(AVG(max_height_cm),0)           AS avg_height_cm,
  ROUND(AVG(pollinator_value),2)        AS avg_pollinator,
  ROUND(AVG(data_confidence),2)         AS avg_confidence
FROM species_catalog
GROUP BY category
ORDER BY species DESC;

-- ============================================================
-- Section 9: Query 6 - Rule coverage counts
-- ============================================================
SELECT 'TOTAL species'                                  AS metric, COUNT(*) AS n FROM species_catalog
UNION ALL SELECT 'R1: sun=FULL or BOTH (full-sun ok)',  COUNT(*) FROM species_catalog WHERE sunlight_preference IN ('FULL','BOTH')
UNION ALL SELECT 'R1: sun=SHADE or PART (shade ok)',    COUNT(*) FROM species_catalog WHERE sunlight_preference IN ('SHADE','PART','BOTH')
UNION ALL SELECT 'R2: water LOW (scarce priority)',      COUNT(*) FROM species_catalog WHERE water_demand='LOW'
UNION ALL SELECT 'R2: water MED + drought (pass)',       COUNT(*) FROM species_catalog WHERE water_demand='MED' AND drought_tolerant=1
UNION ALL SELECT 'R2: water MED no drought (fail)',      COUNT(*) FROM species_catalog WHERE water_demand='MED' AND drought_tolerant=0
UNION ALL SELECT 'R2: water HIGH (always excluded)',     COUNT(*) FROM species_catalog WHERE water_demand='HIGH'
UNION ALL SELECT 'R3: child_pet_safety=SAFE',            COUNT(*) FROM species_catalog WHERE child_pet_safety='SAFE'
UNION ALL SELECT 'R3: child_pet_safety=CAUTION (fail)',  COUNT(*) FROM species_catalog WHERE child_pet_safety='CAUTION'
UNION ALL SELECT 'R3: child_pet_safety=UNSAFE (fail)',   COUNT(*) FROM species_catalog WHERE child_pet_safety='UNSAFE'
UNION ALL SELECT 'R4: indoor_suitable=1',                COUNT(*) FROM species_catalog WHERE indoor_suitable=1
UNION ALL SELECT 'R5: heat_tolerant=1 (extreme ok)',     COUNT(*) FROM species_catalog WHERE heat_tolerant=1
UNION ALL SELECT 'R6: is_climber=1 (severe wind fail)',  COUNT(*) FROM species_catalog WHERE is_climber=1
UNION ALL SELECT 'R6: wind_tolerance=HIGH (adapted)',    COUNT(*) FROM species_catalog WHERE wind_tolerance='HIGH'
UNION ALL SELECT 'R6: wind_tolerance=LOW (fragile)',     COUNT(*) FROM species_catalog WHERE wind_tolerance='LOW'
UNION ALL SELECT 'xeric_adapted=1 (hot-arid bonus)',     COUNT(*) FROM species_catalog WHERE xeric_adapted=1
UNION ALL SELECT 'showy_ornamental=1 (scarce penalty)',  COUNT(*) FROM species_catalog WHERE showy_ornamental=1
UNION ALL SELECT 'invasive=HIGH (0.65x penalty)',        COUNT(*) FROM species_catalog WHERE invasive_risk='HIGH'
UNION ALL SELECT 'edible=1',                             COUNT(*) FROM species_catalog WHERE edible=1
UNION ALL SELECT 'container GOOD or EXCELLENT',          COUNT(*) FROM species_catalog WHERE container_suitability IN ('EXCELLENT','GOOD')
UNION ALL SELECT 'container POOR (rooftop excluded)',    COUNT(*) FROM species_catalog WHERE container_suitability='POOR';

-- ============================================================
-- Section 10: Query 7A - Mumbai: full-sun, extreme heat,
--             scarce water, pet-safe required
-- ============================================================
WITH base AS (
  SELECT code, display_name, category, cooling_contribution,
    maint_tier, container_score_num, pollinator_norm,
    native_fit_score, ml_weight, heat_tolerant, drought_tolerant,
    water_demand, sunlight_preference, invasive_risk, notes,
    CASE sunlight_preference WHEN 'FULL' THEN 1.0 WHEN 'BOTH' THEN 1.0 WHEN 'PART' THEN 0.82 ELSE 0.55 END AS sun_s,
    MAX(0.35, MIN(1.2, 0.85 + ml_weight * 0.05)) AS ml_w,
    (1.0 - MIN(1.0, ABS(maint_tier - 1) * 0.22)) AS maint_gap
  FROM species_catalog
  WHERE active = 1
    AND sunlight_preference IN ('FULL','PART','BOTH')
    AND water_demand != 'HIGH'
    AND NOT (water_demand = 'MED' AND drought_tolerant = 0)
    AND pet_safe = 1
    AND child_pet_safety = 'SAFE'
    AND container_suitability != 'POOR'
    AND heat_tolerant = 1
),
scored AS (
  SELECT *,
    -- base blended score
    MIN(1.0, MAX(0.06,
      (MIN(1.0,MAX(0.06, 0.28+sun_s*0.28+maint_gap*0.18+0.92*0.18+0.78*0.08))*0.25)
      +(MIN(1.0,MAX(0.06, MIN(1.0,cooling_contribution/3.2+0.12)*0.92+sun_s*0.08))*0.25)
      +(MIN(1.0,MAX(0.06, (pollinator_norm*0.20+native_fit_score*0.16+0.78*0.35+sun_s*0.17)*ml_w))*0.25)
      +(MIN(1.0,MAX(0.06, container_score_num*maint_gap*0.92+0.92*0.08))*0.25)
    )) AS blend,
    -- scarce water factor
    CASE WHEN water_demand='LOW' AND drought_tolerant=1 THEN 1.30
         WHEN water_demand='LOW'                        THEN 1.12
         WHEN water_demand='MED' AND drought_tolerant=1 THEN 0.90
         ELSE 0.70 END AS sw_factor,
    -- extreme heat factor
    CASE WHEN heat_tolerant=1 AND drought_tolerant=1 THEN 1.28 ELSE 0.62 END AS heat_factor,
    -- invasive penalty
    CASE invasive_risk WHEN 'HIGH' THEN 0.65 WHEN 'MODERATE' THEN 0.85 ELSE 1.0 END AS inv_factor
  FROM base
)
SELECT
  code, display_name, category,
  ROUND(cooling_contribution,1) AS cooling,
  water_demand,
  CASE WHEN drought_tolerant=1 THEN 'YES' ELSE 'no' END AS drought,
  sunlight_preference AS sun,
  sw_factor, heat_factor,
  ROUND(blend * sw_factor * heat_factor * inv_factor, 4) AS final_score,
  notes
FROM scored
ORDER BY final_score DESC
LIMIT 15;

-- ============================================================
-- Section 11: Query 7B - Shaded balcony, edible garden, pet-safe
-- ============================================================
WITH base AS (
  SELECT code, display_name, category, cooling_contribution,
    maint_tier, container_score_num, pollinator_norm,
    native_fit_score, ml_weight, heat_tolerant, edible, indoor_suitable,
    sunlight_preference, notes,
    CASE sunlight_preference WHEN 'SHADE' THEN 1.0 WHEN 'PART' THEN 0.82 WHEN 'BOTH' THEN 0.90 ELSE 0.55 END AS sun_s,
    MAX(0.35, MIN(1.2, 0.85 + ml_weight * 0.05)) AS ml_w,
    (1.0 - MIN(1.0, ABS(maint_tier - 1) * 0.22)) AS maint_gap,
    CASE WHEN edible=1 THEN 1.0 ELSE 0.10 END AS edible_fit
  FROM species_catalog
  WHERE active = 1
    AND sunlight_preference IN ('SHADE','PART','BOTH')
    AND pet_safe = 1
    AND child_pet_safety = 'SAFE'
    AND container_suitability != 'POOR'
    AND (sunlight_preference != 'FULL' AND min_sun_hours < 6)
),
scored AS (
  SELECT *,
    MIN(1.0, MAX(0.06,
      (MIN(1.0,MAX(0.06, 0.28+sun_s*0.28+maint_gap*0.18+1.0*0.18+edible_fit*0.14))*0.25)
      +(MIN(1.0,MAX(0.06, MIN(1.0,cooling_contribution/3.2+CASE WHEN heat_tolerant=1 THEN 0.12 ELSE 0.0 END)*0.92+sun_s*0.08))*0.25)
      +(MIN(1.0,MAX(0.06, (pollinator_norm*0.20+native_fit_score*0.16+edible_fit*0.50+sun_s*0.17)*ml_w))*0.25)
      +(MIN(1.0,MAX(0.06, container_score_num*maint_gap*0.92+1.0*0.08))*0.25)
    )) AS blend,
    CASE WHEN indoor_suitable=1 AND sunlight_preference IN ('SHADE','PART') THEN 1.18 ELSE 1.0 END AS indoor_boost,
    CASE WHEN edible=1 AND maint_tier=0 THEN 1.08 ELSE 1.0 END AS pet_edible_bonus
  FROM base
)
SELECT
  code, display_name, category,
  CASE WHEN edible=1 THEN 'YES' ELSE '-' END AS edible,
  sunlight_preference AS sun,
  ROUND(cooling_contribution,1) AS cooling,
  indoor_boost, pet_edible_bonus,
  ROUND(blend * indoor_boost * pet_edible_bonus, 4) AS final_score,
  notes
FROM scored
ORDER BY final_score DESC
LIMIT 15;

-- ============================================================
-- Section 12: Query 7C - Rajasthan: hot-arid, severe wind
-- ============================================================
WITH base AS (
  SELECT code, display_name, category, cooling_contribution,
    maint_tier, container_score_num, pollinator_norm,
    native_fit_score, ml_weight, heat_tolerant, drought_tolerant,
    wind_tolerance, low_maintenance, xeric_adapted, sunlight_preference,
    water_demand, invasive_risk, notes,
    CASE sunlight_preference WHEN 'FULL' THEN 1.0 WHEN 'BOTH' THEN 1.0 WHEN 'PART' THEN 0.82 ELSE 0.55 END AS sun_s,
    MAX(0.35, MIN(1.2, 0.85 + ml_weight * 0.05)) AS ml_w,
    (1.0 - MIN(1.0, ABS(maint_tier - 1) * 0.22)) AS maint_gap
  FROM species_catalog
  WHERE active = 1
    AND is_climber = 0
    AND container_suitability != 'POOR'
),
scored AS (
  SELECT *,
    MIN(1.0, MAX(0.06,
      (MIN(1.0,MAX(0.06, 0.28+sun_s*0.28+maint_gap*0.18+0.92*0.18+0.78*0.08))*0.25)
      +(MIN(1.0,MAX(0.06, MIN(1.0,cooling_contribution/3.2+CASE WHEN heat_tolerant=1 THEN 0.12 ELSE 0.0 END)*0.92+sun_s*0.08))*0.25)
      +(MIN(1.0,MAX(0.06, (pollinator_norm*0.20+native_fit_score*0.16+0.78*0.35+sun_s*0.17)*ml_w))*0.25)
      +(MIN(1.0,MAX(0.06, container_score_num*maint_gap*0.92+0.92*0.08))*0.25)
    )) AS blend,
    CASE
      WHEN xeric_adapted=1 AND drought_tolerant=1 AND cooling_contribution>=2.5 AND heat_tolerant=1 THEN 1.34
      WHEN drought_tolerant=1 AND cooling_contribution>=1.5 AND heat_tolerant=1 THEN 1.12
      WHEN drought_tolerant=0 OR cooling_contribution<1.5 THEN 0.72
      ELSE 0.88
    END AS xeric_factor,
    CASE
      WHEN wind_tolerance='HIGH' AND drought_tolerant=1 AND low_maintenance=1 THEN 1.22
      WHEN wind_tolerance='HIGH'     THEN 1.08
      WHEN wind_tolerance='MODERATE' THEN 0.84
      ELSE 0.70
    END AS wind_factor,
    CASE WHEN heat_tolerant=1 AND drought_tolerant=1 THEN 1.28 ELSE 0.62 END AS heat_factor,
    CASE invasive_risk WHEN 'HIGH' THEN 0.65 WHEN 'MODERATE' THEN 0.85 ELSE 1.0 END AS inv_factor
  FROM base
)
SELECT
  code, display_name, category,
  CASE WHEN xeric_adapted=1 THEN 'YES' ELSE '-' END AS xeric,
  CASE WHEN drought_tolerant=1 THEN 'YES' ELSE '-' END AS drought,
  CASE WHEN heat_tolerant=1 THEN 'YES' ELSE '-' END AS heat,
  wind_tolerance AS wind, sunlight_preference AS sun,
  ROUND(cooling_contribution,1) AS cooling,
  xeric_factor, wind_factor, heat_factor,
  ROUND(blend * xeric_factor * wind_factor * heat_factor * inv_factor, 4) AS final_score,
  notes
FROM scored
ORDER BY final_score DESC
LIMIT 15;

-- ============================================================
-- Section 13: Query 7D - Standard rooftop, full sun, no constraints
-- ============================================================
WITH base AS (
  SELECT code, display_name, category, cooling_contribution,
    maint_tier, container_score_num, pollinator_norm,
    native_fit_score, ml_weight, heat_tolerant, sunlight_preference,
    water_demand, invasive_risk, notes,
    CASE sunlight_preference WHEN 'FULL' THEN 1.0 WHEN 'BOTH' THEN 1.0 WHEN 'PART' THEN 0.82 ELSE 0.55 END AS sun_s,
    MAX(0.35, MIN(1.2, 0.85 + ml_weight * 0.05)) AS ml_w,
    (1.0 - MIN(1.0, ABS(maint_tier - 1) * 0.22)) AS maint_gap,
    CASE invasive_risk WHEN 'HIGH' THEN 0.65 WHEN 'MODERATE' THEN 0.85 ELSE 1.0 END AS inv_factor
  FROM species_catalog
  WHERE active = 1 AND container_suitability != 'POOR'
)
SELECT
  code, display_name, category,
  sunlight_preference AS sun, water_demand,
  ROUND(cooling_contribution,1) AS cooling,
  ROUND(MIN(1.0, MAX(0.06,
    (MIN(1.0,MAX(0.06, 0.28+sun_s*0.28+maint_gap*0.18+1.0*0.18+0.78*0.08))*0.25)
    +(MIN(1.0,MAX(0.06, MIN(1.0,cooling_contribution/3.2+CASE WHEN heat_tolerant=1 THEN 0.12 ELSE 0.0 END)*0.92+sun_s*0.08))*0.25)
    +(MIN(1.0,MAX(0.06, (pollinator_norm*0.20+native_fit_score*0.16+0.78*0.35+sun_s*0.17)*ml_w))*0.25)
    +(MIN(1.0,MAX(0.06, container_score_num*maint_gap*0.92+1.0*0.08))*0.25)
  ) * inv_factor, 4) AS final_score,
  notes
FROM base
ORDER BY final_score DESC
LIMIT 20;

-- ============================================================
-- Section 14: Query 8 - ML training feature export
-- ============================================================
SELECT
  code AS species_key,
  CASE WHEN climate_suitability LIKE '%HOT_HUMID%'
            OR climate_suitability LIKE '%TROPICAL%' THEN 0.9
       WHEN climate_suitability LIKE '%HOT_DRY%'     THEN 0.85
       WHEN climate_suitability LIKE '%SUBTROPICAL%'  THEN 0.75
       ELSE 0.6 END                                         AS climate_suitability,
  CASE sunlight_preference WHEN 'FULL' THEN 1.0 WHEN 'BOTH' THEN 0.875
    WHEN 'PART' THEN 0.5 WHEN 'SHADE' THEN 0.25 ELSE 0.5 END AS sunlight_pref_norm,
  CASE water_demand WHEN 'LOW' THEN 0.2 WHEN 'MED' THEN 0.5 WHEN 'HIGH' THEN 0.9 ELSE 0.5 END AS water_demand_norm,
  CASE maintenance_need WHEN 'LOW' THEN 0.2 WHEN 'MED' THEN 0.5 WHEN 'HIGH' THEN 0.85 ELSE 0.5 END AS maintenance_norm,
  ROUND(MIN(cooling_contribution / 5.0, 1.0), 4)            AS cooling_norm,
  container_score_num                                        AS container_norm,
  CASE WHEN pet_safe = 1 THEN 1.0 ELSE 0.0 END              AS pet_safe_norm,
  CASE WHEN edible = 1 THEN 1.0 ELSE 0.0 END                AS edible_norm,
  CASE WHEN drought_tolerant = 1 THEN 1.0 ELSE 0.0 END      AS drought_norm,
  CASE WHEN heat_tolerant = 1 THEN 1.0 ELSE 0.0 END         AS heat_norm,
  ROUND(pollinator_norm, 4)                                  AS pollinator_norm,
  ROUND(MIN(privacy_contribution / 5.0, 1.0), 4)            AS privacy_norm,
  CASE WHEN xeric_adapted = 1 THEN 1.0 ELSE 0.0 END         AS xeric_norm,
  CASE WHEN is_climber = 1 THEN 0.0 ELSE 1.0 END            AS wind_safe_norm,
  ROUND(ml_weight, 4)                                        AS ml_weight,
  ROUND(data_confidence, 4)                                  AS data_confidence
FROM species_catalog WHERE active = 1 ORDER BY code;

-- ============================================================
-- Section 15: Query 9 - Engine constants reference
-- ============================================================
SELECT rule_code, constant, value, description
FROM rule_constants
ORDER BY rule_code, constant;
