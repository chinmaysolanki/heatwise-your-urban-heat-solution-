# HeatWise canonical demo flow (24h presenter path)

This document locks **one** end-to-end path: **project → recommendations → session → quote → dossier / user report**. It uses only existing APIs and services.

## TL;DR startup

```bash
cd heatwise
cp .env.example .env.local   # if needed; set DATABASE_URL
npx prisma migrate dev       # or db push for local SQLite
npm run demo:setup           # species catalog + demo user/projects
# Copy printed HEATWISE_DEMO_* ids into .env.local
npm run demo:check           # should print PASS
npm run demo:start           # http://localhost:3000
```

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | **Yes** | Prisma (SQLite or Postgres) |
| `NEXTAUTH_URL` | For browser session | e.g. `http://localhost:3000` |
| `NEXTAUTH_SECRET` | For browser session | Random secret |
| `HEATWISE_DEMO_USER_EMAIL` | Optional | Default `demo@heatwise.local` for seed |
| `HEATWISE_DEMO_USER_ID` | **Smoke + curl** | Printed by `npm run demo:seed` |
| `HEATWISE_DEMO_PROJECT_ROOFTOP_ID` | **Smoke + curl** | Primary demo project id |
| `HEATWISE_DEMO_PROJECT_TERRACE_ID` | Optional | Second demo project |
| `HEATWISE_ENABLE_E2E_ISSUER` | Dev login | Set `1` on server to allow `/api/e2e/issue-session` |
| `HEATWISE_E2E_ISSUER_SECRET` | Dev login | Shared secret for issue-session header |
| `HEATWISE_OPS_TOKEN` | Optional | Ops-only tools; **not** required for owner-session dossier/report |

**Enrichment (optional for demo):**

- `HEATWISE_GEO_ENRICHMENT=0` — skip geo (faster, fewer failures)
- `HEATWISE_PRICING_ENRICHMENT=0` — skip pricing enrichment
- Omit or leave unset to try full enrichment; failures are non-fatal for `/api/recommendations/generate` (warnings on response).

## Seeded entities

After `npm run demo:seed`:

- **User:** `demo@heatwise.local` (or `HEATWISE_DEMO_USER_EMAIL`)
- **Project A (rooftop):** “Demo — Rooftop (Bengaluru)” — use as primary flow
- **Project B (terrace):** “Demo — Terrace (Bengaluru)” — secondary story
- **Spaces:** one per project with simple dimensions (for future UI/analysis)

Run `npm run db:seed` before `demo:seed` so `SpeciesCatalog` exists (recommendation runtime may reference species).

## UI path

1. Open **`http://localhost:3000`** — main `HeatWiseApp` experience.
2. Sign in using your configured auth **or** (dev) mint a session:
   - `POST /api/e2e/issue-session` with JSON `{ "email": "demo@heatwise.local" }` and header `x-heatwise-e2e-issuer-secret: <HEATWISE_E2E_ISSUER_SECRET>`  
   - Requires `HEATWISE_ENABLE_E2E_ISSUER=1` on the server.
3. Work through photo / project flow in-app, **or** drive the **API path** below with the seeded `projectId` (closer to a guaranteed scriptable demo).

**Presenter tip:** For a **scriptable** demo, prefer the **API sequence** with `curl` or the in-process `npm run demo:check` output, then show JSON in `demoPresentation` / `format=demo` responses.

## API sequence (canonical)

Replace `BASE=http://localhost:3000`, `PROJECT_ID`, `USER_ID` (or rely on session cookie and omit `userId` in body where optional).

### 1) Generate recommendations

`POST /api/recommendations/generate`

- **Query:** `?demo=1` adds **`demoPresentation`** (compact cards, human labels, enrichment status).
- **Body (minimal):** `project`, `environment`, `preferences`, `projectId`, `userId` (optional but good for attribution).

Example:

```http
POST /api/recommendations/generate?demo=1
Content-Type: application/json

{
  "projectId": "<HEATWISE_DEMO_PROJECT_ROOFTOP_ID>",
  "userId": "<HEATWISE_DEMO_USER_ID>",
  "project": {
    "id": "<HEATWISE_DEMO_PROJECT_ROOFTOP_ID>",
    "name": "Demo — Rooftop (Bengaluru)",
    "location": "Indiranagar, Bengaluru",
    "surfaceType": "Rooftop",
    "primaryGoal": "cooling",
    "area": 42,
    "budget_inr": 150000
  },
  "environment": {
    "city": "Bengaluru",
    "region": "KA",
    "sunlight_hours": 6,
    "shade_level": "partial",
    "drainage_quality": "good",
    "water_availability": "good"
  },
  "preferences": {
    "budget_inr": 150000,
    "maintenance_level": "moderate"
  },
  "maxCandidates": 3,
  "skipGeoEnrichment": true,
  "skipSupplyConstraints": true,
  "skipPricingEnrichment": false
}
```

**Response:** `candidates[]`, `telemetryMeta`, optional `enrichmentWarnings`, **`demoPresentation`** when `demo=1`.

### 2) Persist telemetry session

`POST /api/recommendations/create-session`

Body: `projectId`, `userId`, `modelVersion`, `rulesVersion`, `generatorSource`, snapshots, `totalCandidates`, `latencyMs`, `candidates[]` (ranks + `candidatePayload`), optional `idempotencyKey`.

Map fields from step 1 response (see `scripts/e2e-recommendation-workflow.ts`).

### 3) Request quote

`POST /api/installers/request-quote` — **requires logged-in project owner** (session cookie).

Body:

- `projectId`
- `recommendationSessionId`
- `selectedCandidateSnapshotId` (chosen rank)
- `userLocationRegion` (e.g. `IN-KA`)
- `projectSnapshot`, `candidateSnapshot`
- optional `idempotencyKey`

Errors return structured JSON (`error.code`, `error.message`), e.g. `SESSION_MISMATCH` if ids don’t line up.

### 4) Assemble user dossier

`POST /api/reports/recommendation-dossier` — **ops token, admin session, or project owner session**.

Body:

```json
{
  "recommendationSessionId": "<from step 2>",
  "dossierType": "user_final_recommendation",
  "userId": "<optional>",
  "selectedCandidateSnapshotId": "<chosen snapshot id>"
}
```

### 5) User report (polished)

`GET /api/reports/user-report?dossierId=<id>&format=demo`

- **`format=demo`:** returns `summary` object (project overview, cooling, cost, maintenance, constraints, confidence, next steps) suited for slides.
- Without `format`: full structured `ReportPayloadView` (user-visible sections only).

## Example compact payloads

### `demoPresentation` (fragment from generate `?demo=1`)

```json
{
  "title": "Ranked cooling recommendations",
  "generatorMode": "Rules-based",
  "enrichment": {
    "geo": "Not run",
    "supply": "Not run",
    "pricing": "Included"
  },
  "candidates": [
    {
      "rank": 1,
      "headline": "…",
      "recommendationType": "Cooling & greenery plan",
      "tempReduction": "Up to ~2.5°C cooler (air)",
      "installCost": "About ₹…",
      "maintenance": "About ₹… / yr",
      "highlights": ["…"],
      "watchouts": []
    }
  ]
}
```

### User report `format=demo`

```json
{
  "scope": "user",
  "format": "demo",
  "summary": {
    "projectSummary": "Demo — Rooftop (Bengaluru) · Indiranagar, Bengaluru · Rooftop · cooling · 42",
    "recommendationOverview": "3 · hw-rules-… · ml_orchestrator",
    "coolingImpact": "Top options target up to ~…°C …",
    "costSummary": "Linked cost estimates: …",
    "maintenanceSummary": "Annual maintenance ranges …",
    "constraintsAndWatchouts": [],
    "confidenceAndProvenance": "Based on 3 options · rules … · model …",
    "nextSteps": ["Request a formal quote …", "…"]
  }
}
```

## Optional: installer / admin slices

- Installer-oriented dossier: same POST with `dossierType: "installer_execution_summary"`.
- Admin: `admin_internal_review` (risk-heavy; use only if audience is internal).
- Full unfiltered preview remains ops/admin: `GET /api/reports/report-preview?dossierId=…`.

## Reliability notes

- Generate path **continues** with partial enrichment; check `enrichmentWarnings` and `demoPresentation.watchouts`.
- Quote failures are usually **linkage** (wrong `projectId` / session / snapshot) — messages are explicit.
- `npm run demo:check` skips geo/supply/pricing by default for a **stable PASS**; live demo can re-enable enrichment flags.

## References

- E2E HTTP: `docs/E2E_HTTP_WORKFLOW.md`, `npm run e2e:workflow`
- Reporting contracts: `ml/reporting_intelligence/README.md`
