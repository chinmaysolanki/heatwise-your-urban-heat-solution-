# Admin metrics specification (v1)

## Purpose

Internal analytics and ML-ops aggregates for recommendation quality, funnel health, experiments, and rollout monitoring. **Not** end-user facing.

## Auth (API)

All routes under `/api/admin/*` (except where noted) require:

1. Valid NextAuth session.
2. Email in `HEATWISE_ADMIN_EMAILS` (comma-separated) when `NODE_ENV=production`.
3. **Placeholder**: add API gateway / VPN / mTLS in production; this app-layer check is necessary but not sufficient.

## Response envelope

```json
{
  "schema_version": "admin_metrics.v1",
  "generated_at": "ISO-8601",
  "export_ready": true,
  "window": { "start": "ISO-8601", "end": "ISO-8601" },
  "data": { }
}
```

BI tools and Python exporters should key off `schema_version` and `export_ready`.

## Metric groups

### A — Recommendation funnel

| Field | Definition |
|-------|------------|
| `sessions_generated` | `RecommendationTelemetrySession` count in time window (`generatedAt`). |
| `impression` | Distinct sessions with ≥1 `recommendation_impression` or `recommendation_view`. |
| `expand` | Distinct sessions with `recommendation_expand`. |
| `save` | Distinct sessions with `recommendation_save`. |
| `select` | Distinct sessions with `recommendation_select`. |
| `installer_request` | Distinct sessions with `recommendation_request_installer`. |
| `install_completed` | `InstallOutcomeRecord` rows with `installStatus=completed` and `createdAt` in window. |

Rates:

- `rates_vs_sessions.*` = stage / `sessions_generated`
- `rates_vs_impression.*` = stage / `impression` (conditional on impression > 0)

Aligned with `FEEDBACK_EVENT_TYPES` in `lib/recommendationTelemetryConstants.ts`.

### B — Experiment / variant (v1)

| Field | Definition |
|-------|------------|
| `variant_key` | `{generatorSource}::{rulesVersion}` from telemetry session (until DB stores `experiment_id`). |
| Event counts | Summed `RecommendationTelemetryEvent` per session in window. |
| Evaluation overlay | Optional line count / path for `ml/evaluation/data/runtime_evaluations.jsonl`. |

### C — Rollout monitor

| Field | Definition |
|-------|------------|
| `rollout_state` | `ml/evaluation/data/rollout_state.json`. |
| `active_experiments_count` | `status===active` in `experiments.json`. |
| `health_proxy` | Median session latency, generator source mix in window. |

### D — Installer outcomes

| Field | Definition |
|-------|------------|
| `summary` | Status histogram + numeric averages from `InstallOutcomeRecord`. |
| `by_cohort` | Same rows grouped by `project_type`, `climate_zone`, `budget_band` from linked `RecommendationTelemetrySession` snapshots (or `unknown` if no session). |

### E — Cohort dimensions

Extracted from JSON snapshots (same logic TS/Python):

- **project_type**: `projectType` \| `type` \| `spaceType` \| `project_type`
- **climate_zone**: `environment.climateZone` \| `climate_zone` \| project fallbacks
- **budget_band**: `budgetRange` string, else INR buckets from `budget_inr`

## Offline export bundle

For `admin_analytics/exporters/export_admin_metrics.py`, use the bundle schema documented in that module. Keep field names **camelCase** to match Prisma exports.

## Versioning

Bump `schema_version` when breaking `data` shapes (e.g. `admin_metrics.v2`).
