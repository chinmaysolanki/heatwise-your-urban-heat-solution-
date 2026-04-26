# Supply-side intelligence & seasonal constraints

## Why this exists

HeatWise recommendations must be **executable**, not only statistically plausible. Supply-side realism connects model scores to **what can actually be procured and installed** in a region and season. Without it, the system can over-rank species, materials, or shade systems that are unavailable, delayed, or unsafe to install in the current window—hurting trust, installer outcomes, and the quality of training labels.

## Recommendation quality vs execution readiness

- **Recommendation quality** (ML + rules): fit to preferences, thermal story, aesthetics, and historical engagement.
- **Execution readiness**: installer coverage, inventory/stock, irrigation/structural capability, and **seasonal viability**.

This package models execution readiness as **scores and constraints** that can be logged, replayed, and exported as training features.

## Hard vs soft constraints

- **Hard blocks** remove or zero-score candidates (e.g. species unavailable with no substitute, material `out`, seasonal `unsuitable` for a species or solution type).
- **Soft penalties** rescale the blended runtime score (e.g. limited stock, long lead time, weak irrigation readiness for drip-heavy plans).
- **Substitutions** replace a blocked primary species before scoring when a curated substitute exists.
- **Defer-install** is expressed via `deferInstallSuggested`, `recommended_now_vs_later`, and notes—not as a second recommender.

## Seasonality

`SeasonalWindow` rows describe **region × climate_zone** windows with optional `species_name` / `solution_type`. At runtime, the active month is compared to `start_month` / `end_month` (including wrap-around ranges). Unsuitable windows contribute **seasonal blocks** and lower **seasonal_readiness_score**.

## Runtime wiring

- **Node** (`recommendationConstraintService`) loads Prisma tables and builds `supplyConstraints` **v1** on `POST /api/recommendations/generate` (unless `skipSupplyConstraints` or `HEATWISE_SUPPLY_CONSTRAINTS=0`).
- **Python** (`serving/orchestration/supply_constraints.py`) applies blocks, substitutions, and soft multipliers **after** ML blending, then re-sorts. Telemetry includes `telemetryMeta.supplyConstraints` and optional `supplyIntelligenceMeta` on the response.

## Training & analytics

- **Mappers** turn rows into feature-friendly dicts.
- **Exporters** emit CSV for hybrid dataset builders and retraining pipelines.
- **Validators** guard JSONL/ETL inputs (enums, months, scores in `[0,1]`, substitute self-cycles).

## How this improves install success and retraining

1. **Runtime**: Fewer “pretty but impossible” cards; installers see **operational_risk_level**, lead-time and readiness notes, and substitution transparency.
2. **Labels**: Constraint snapshots are **reproducible** (region, climate, month, blocked sets, readiness scores)—strong covariates for outcome models and calibration.
3. **Iteration**: Exported features (`region_supply_readiness_score`, `constraint_penalty_score`, etc.) tie **supply friction** to realized installs and remeasurements.
