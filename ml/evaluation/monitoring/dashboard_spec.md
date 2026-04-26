# Dashboard spec — recommendation evaluation

Internal dashboard (Grafana / Metabase / custom) should expose:

## Row 1 — Serving health

- Request volume (1h / 24h) by variant and environment
- Median and p95 latency
- Error rate and fallback rate
- Shadow compute failure rate (when shadow enabled)

## Row 2 — Experiment

- Active experiments and phase (shadow / 5% / 25% / …)
- Assignment counts by `bucket_id` and `assigned_variant`
- Top-1 match rate (primary vs shadow) when in shadow mode

## Row 3 — Engagement proxies

- Save / expand / compare / select rates by variant
- Installer and AR preview request rates
- Explicit feedback positive / negative rates

## Row 4 — Outcomes (when data exists)

- Install conversion by variant
- Post-install satisfaction
- Measured temperature change (if instrumented)

## Row 5 — Distribution

- Project type, budget band, climate zone mix
- Top species frequency (rolling)
- Score histogram vs baseline

## Drill-downs

- Filter by `experiment_id`, `project_type`, `climate_zone`, `budget_band`
- Compare treatment vs control with confidence notes (proxy metrics)
