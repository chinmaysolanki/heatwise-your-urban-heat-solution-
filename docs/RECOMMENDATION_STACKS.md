# Parallel recommendation stacks

## Shared layout orchestration (Phase 1 consolidation)

- **Module:** `lib/recommendation/orchestrateLayoutRecommendations.ts` — ML runtime (or precomputed ML output) + `@/recommendation-engine` `runPipeline`, merge, spatial mapping, heat summary, optional DB persist.
- **`POST /api/generate-layout`** — thin compatibility wrapper; same JSON response shape as before.
- **`POST /api/recommendations/generate`** — canonical enrichment + ML path; may attach **`layoutGeneration`** when the body maps to `ProjectInput` via `recommendationRequestToProjectInput` (does not duplicate `RecommendationRun` persistence in Phase 1).

## 1. ML runtime (primary for ranked candidates)

- **Entry:** `POST /api/recommendations/generate` → `generateRecommendationsRuntime` → `python -m serving` under `HEATWISE_ML_CWD` (default `heatwise/ml`).
- **Fallback:** If Python exits non-zero or returns invalid JSON, `buildRulesOnlyFallback` in `lib/recommendation/rulesOnlyFallback.ts` produces **`live_rules`** candidates (`mode: "rules_only"`).
- **Telemetry:** Clients should call `POST /api/recommendations/create-session` with `telemetryMeta` from the generate response (`generatorSource`, `rulesVersion`, model head versions).

**When to use:** Product recommendation slate, pricing/geo/supply enrichment, experiment shadow eval.

## 2. Legacy layout / template engine (`recommendation-engine/`)

- **Entry:** `@/recommendation-engine` — spatial layout, plant templates, constraint filtering for **3D / layout generation** flows (`pages/api/generate-layout.ts`, AR helpers).
- **Not** the same as Python `ml/serving` ranker; naming overlap is historical.

**When to use:** Layout generation, spatial mapping, feedback tied to that pipeline.

## Deprecation / compatibility

- Do not rely on the removed **`recommendation engine/`** folder (space). Import **`recommendation-engine`** only; that folder is a README pointer only and is excluded from `tsconfig.json`.
- `generatorSource` values `live_rules` vs `ml_ranker` / `hybrid` distinguish TS fallback vs ML path in telemetry.

| Client intent | Stack | Key entry |
|---------------|-------|-----------|
| Ranked product recommendations, enrichment, experiments | ML runtime + Node | `POST /api/recommendations/generate` |
| 3D layout, AR spatial mapping, layout templates | TS `recommendation-engine` (via shared orchestrator) | `POST /api/generate-layout`, optional `layoutGeneration` on `POST /api/recommendations/generate`, `@/recommendation-engine` |

See also [`ARCHITECTURE_RECOMMENDATION_ENGINES.md`](./ARCHITECTURE_RECOMMENDATION_ENGINES.md).

### Historical: GPT analysis API

The former `POST /api/analysis/run` and `GET /api/analysis/[projectId]` routes were **removed** (no in-repo callers; main app never wired them). The **`Analysis`** Prisma model and `GET /api/projects` payloads may still surface legacy rows if present in the database.
