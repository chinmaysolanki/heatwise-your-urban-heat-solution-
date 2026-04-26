# Pricing intelligence & cost estimation

## Why this matters

Users and installers need **financially usable** recommendations. Thermal fit and species choice are not enough if the card implies a cost band that is off by 2× or ignores maintenance. Pricing intelligence separates **recommendation quality** (will it work ecologically?) from **affordability** (can the user execute it without distress?), while logging structured estimates for **quote calibration** and **retraining**.

## Recommendation quality vs affordability

- **Quality**: cooling strategy, feasibility, supply/seasonal constraints, installer coverage.
- **Affordability**: how median / upper estimates relate to stated budget, stretch requirements, and phased options.

Both can be true: a great ecological option may be **near_budget_limit** or **stretch_required**.

## Estimate band philosophy

We emit **min / median / max** for install and maintenance. The median is the planning anchor; the band reflects **heuristic uncertainty** (site unseen, scope drift, regional volatility). Supply readiness and defer-install signals **widen** the band and raise **quote_volatility_score**. This is **not** a formal quote — it is a **pre-quote planning range** aligned with installer workflows.

## Confidence and volatility

- **estimate_confidence_band**: `tight` → `very_wide` — how narrow we believe the band is (execution + data certainty).
- **quote_volatility_score** (0–1): expected installer-to-installer and site-visit variance.
- **contingency_pct**: suggested planning buffer when volatility is elevated.

## Quote comparison and learning

`QuoteComparisonRecord` links **predicted median** → **quoted** → **final job cost**. Diagnostics (`underpredicted`, `quote_escalated_post_site_visit`, etc.) feed **pricing accuracy** analytics and future supervised models (targets: quoted amount, final cost, error %).

## Current limitations & future ML path

- **v1** uses **hybrid heuristics** in TypeScript (`pricingEstimateService`), structured for later replacement by learned heads (per region / solution type).
- No marketplace-style live price feeds yet; **installer_benchmark** optionally blends recent regional quote medians when enabled.
- Training exports are **schema-stable** CSV/JSONL for hybrid dataset builders and retraining pipelines.
