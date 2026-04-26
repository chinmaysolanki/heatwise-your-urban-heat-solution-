# Geospatial & microclimate intelligence

## Why it matters

Rooftop and balcony cooling recommendations depend on **local exposure**: sun hours, radiant heat, wind, water availability, and urban heat island context. Generic “average” assumptions mis-rank options and weaken feasibility stories. This layer adds **trainable, explainable** geo and microclimate signals without standing up a full GIS stack.

## Coarse vs exact site context

- **Coarse**: region, city, climate zone, and inferred bands when lat/lon are missing — still valid when `source_type` / confidence reflect proxy mode (`geo_coarse_enrichment: true`).
- **Exact**: lat/lon + instrument fields (temps, humidity, peak surface temp) tighten **source_confidence** and narrow derived scores.

## Confidence philosophy

Confidence is **epistemic** (how much we trust inputs), not a probability of outcome. Coarse enrichment intentionally lowers confidence; UI should surface `confidence_note` and avoid over-precision in copy.

## Effect on ranking, feasibility, and heat prediction

- **ML**: `merge_snapshots_to_row` pulls all `environment` keys into the feature row — geo-prefixed fields become available to bundles that include those columns (otherwise NaN-filled).
- **Rules runtime**: `geo_adjustments.py` applies **small** multipliers (≈ ±6%) after supply constraints, favoring greening/shade/irrigation alignments with site stress.
- **Explanations**: Node attaches narrative fields on each candidate after Python returns.

## Limitations & future spatial models

v1 uses **heuristics** over project/environment snapshots. Future: raster UHI layers, building height context, learned calibration from verified installs, and seasonal time-series per project.
