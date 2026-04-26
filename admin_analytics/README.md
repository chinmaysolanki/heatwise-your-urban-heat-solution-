# HeatWise `admin_analytics`

Backend-oriented **aggregations** and **export** utilities for internal dashboards and ML operations. UI is out of scope.

## Contents

| Path | Role |
|------|------|
| `specs/admin_metrics_spec.md` | Metric definitions + alignment with telemetry / evaluation |
| `aggregations/` | Pure functions on exported row dicts (Python) |
| `exporters/export_admin_metrics.py` | CLI: bundle JSON → aggregated admin JSON |
| `tests/` | Parity / regression tests for aggregations |

## Live API (Next.js)

Implemented under `pages/api/admin/`:

- `metrics-overview` — funnel + outcomes + volumes; `?include_cohorts=1` adds cohort funnel.
- `recommendation-funnel` — funnel only.
- `experiment-summary` — variant metrics + evaluation file hints.
- `rollout-monitor` — rollout JSON + health proxy.
- `installer-outcomes` — summary + by cohort.

Shared auth: `lib/adminAuth.ts` (`HEATWISE_ADMIN_EMAILS`, NextAuth session).

## Running the Python exporter

From the **`heatwise`** directory (so `admin_analytics` is importable):

```bash
cd heatwise
PYTHONPATH=. python -m admin_analytics.exporters.export_admin_metrics path/to/bundle.json -o admin_out.json
```

## Tests

```bash
cd heatwise
PYTHONPATH=. python -m pytest admin_analytics/tests/ -q
```

## Relationship to other layers

- **Telemetry**: `RecommendationTelemetrySession`, `RecommendationTelemetryEvent`, `InstallOutcomeRecord` (Prisma).
- **Evaluation**: `ml/evaluation/data/experiments.json`, `rollout_state.json`, `runtime_evaluations.jsonl` (referenced from TS services).
- **Legacy analytics**: `pages/api/admin/analytics.ts` + `lib/internalAnalytics.ts` (photo pipeline–centric) remains; new routes are ML-session–centric.
