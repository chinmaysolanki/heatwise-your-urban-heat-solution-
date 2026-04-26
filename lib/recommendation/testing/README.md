# Recommendation runtime test plan

Structured tests for the hybrid recommendation stack (Python serving, `catalog_hybrid_ts`, rules-only emergency), constraints, species identity, and layout gates.

## Test groups

| File | What it covers |
|------|----------------|
| `ml-runtime.contract.test.ts` | Node validation of Python stdout JSON (`pythonRecommendationPayloadUnusableReason`) — empty, all-blocked, bad mode, etc. |
| `rules-only.scenarios.test.ts` | `buildRulesOnlyFallback` for every scenario in `scenarios.ts` — non-empty slate, ranking order, budget sanity. |
| `catalog-hybrid.scenarios.test.ts` | `buildCatalogHybridFallback` with forced `python_nonzero_exit` — catalog path, `species_catalog_code` on open candidates, pet-safe / edible / water-scarce assertions. **Requires DB** with `SpeciesCatalog` rows. |
| `layout-eligibility.scenarios.test.ts` | `getLayoutEligibility` — eligible scenarios have floor dims + supported space; negative cases. |
| `identity.scenarios.test.ts` | `resolveSpeciesIdentityFromRuntimeCandidate` — explicit code, mapped display, unresolved unknowns. |
| `runtime-emergency.shape.test.ts` | Shape of emergency escalation (`rules_only` + catalog hybrid error markers) for observability contracts. |
| `recommendation-ml.integration.test.ts` | Optional real `python -m serving` (off by default). |
| `generate-api.e2e.test.ts` | **API/orchestration:** imports `pages/api/recommendations/generate` default handler; mock `NextApiRequest` / `NextApiResponse`; stubs Python via `HEATWISE_ML_PYTHON` executable that exits 1 (forces Node fallback). Asserts `layoutSlate` / `layoutGeneration` contracts, 405/400, `telemetryMeta`, fallback hints. |
| `api/invokeRecommendationsGenerate.ts` | Helpers: mock req/res, failing Python shim, `invokeRecommendationsGenerate`. |

## Scenarios (`scenarios.ts`)

Fixed `RecommendationGenerateRequest` fixtures: sunny balcony, hot terrace, shaded aesthetic, pet-safe, edible, windy high-rise, water-scarce. Extend here when adding new product intents.

## Running locally

From the HeatWise app root (`heatwise/`):

```bash
export DATABASE_URL="file:./prisma/dev.db"   # or your Prisma URL
npm run test:recommendation
```

Catalog hybrid tests **skip** if:

- `SKIP_RECOMMENDATION_DB_TESTS=1`, or
- Prisma errors, or
- no active `SpeciesCatalog` rows.

Optional Python integration:

```bash
HEATWISE_RUN_ML_INTEGRATION=1 npm run test:recommendation
```

API E2E tests **do not start `next dev`**: they call the route handler directly. Python is replaced with a temp `exit 1` shim so responses use `catalog_hybrid_ts` or `live_rules` while layout orchestration still runs.

Keep the DB schema current (`npx prisma migrate deploy`) so `scheduleRecommendationRuntimeObservation` does not log missing-table errors (tests still pass; failures are caught and logged).

Shell helper: `scripts/run-recommendation-tests.sh`.

## Evaluation report (quality diff / review)

Runs all fixed scenarios through the **canonical generate handler** (Python stubbed for deterministic fallback) and writes:

- `reports/recommendation-eval/recommendation-eval.json`
- `reports/recommendation-eval/recommendation-eval.md`
- `reports/recommendation-eval/recommendation-eval.csv`

```bash
npm run report:recommendation-eval
# custom out dir:
npx tsx scripts/recommendation-evaluation-report.ts --out path/to/dir
```

Summarizer lives in `lib/recommendation/testing/evaluationReport.ts` (usable from tests or scripts). Fields include `generator_source`, top open species names/codes, `layout_slate_status` / `layout_attached`, `species_catalog_code_coverage_open`, `unresolved_open_count`, and **hard-constraint** open/blocked counts.

## CI

Add `npm run test:recommendation` to CI with `DATABASE_URL` and `npx prisma migrate deploy` (or seeded SQLite) so catalog-hybrid tests exercise real data.

## Limitations

- **HTTP server** E2E (real `fetch` to `:3000`) is not required here; the handler is invoked in-process.
- **Emergency rules-only** when the catalog has **zero** species is not exercised automatically (would require an isolated empty DB or DI); the **response shape** is covered in `runtime-emergency.shape.test.ts`.
