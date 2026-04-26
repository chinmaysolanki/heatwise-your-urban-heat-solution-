# Demo presenter checklist

Use this the day of the demo. Full flow: `../DEMO_FLOW.md`.

## Before you go live (~15 min)

- [ ] `cd heatwise` — correct repo branch, clean working tree if possible.
- [ ] `.env.local`: `DATABASE_URL`, `NEXTAUTH_*`, demo ids (`HEATWISE_DEMO_USER_ID`, `HEATWISE_DEMO_PROJECT_ROOFTOP_ID`).
- [ ] Database: `npx prisma migrate dev` (or your usual local setup).
- [ ] `npm run demo:setup` (catalog + demo user/projects) if DB was reset.
- [ ] `npm run demo:check` → must print **`PASS`**.
- [ ] `npm run demo:start` — open `http://localhost:3000` once to ensure no boot errors.
- [ ] Browser: sign-in path works **or** E2E issuer ready (`HEATWISE_ENABLE_E2E_ISSUER=1` + secret).

## First screen

- [ ] Open **`/`** (HeatWise home) **or** your API client with `BASE=http://localhost:3000`.
- [ ] Say: “We’ll walk from a real project record through ranked options, a persisted session, quote, and a structured report.”

## Click / API path (happy path)

1. **Project context** — Seeded “Demo — Rooftop (Bengaluru)” or your chosen project id.
2. **Generate** — `POST /api/recommendations/generate?demo=1` — show **`demoPresentation.candidates`** (rank, headline, temp, costs).
3. **Session** — `POST /api/recommendations/create-session` — say “this freezes the run for audit and quotes.”
4. **Pick one option** — note `candidateSnapshotIds[i]`.
5. **Quote** — `POST /api/installers/request-quote` as logged-in owner — show **201** + `quoteRequestId`.
6. **Dossier** — `POST /api/reports/recommendation-dossier` (owner session) — copy `recommendationDossierId`.
7. **Report** — `GET /api/reports/user-report?dossierId=…&format=demo` — show **`summary`** for slides.

## What to highlight at each step

| Step | Highlight |
|------|-----------|
| Generate | Ranked options, enrichment status, readable watchouts (not raw stack traces). |
| Session | Traceability: model/rules versions, reproducible snapshots. |
| Quote | Hand-off to installer network; idempotency for retries. |
| Report | Next steps + confidence line; no internal admin jargon in `format=demo`. |

## Fallback if something breaks

| Symptom | Fallback |
|---------|----------|
| Geo/pricing errors | Show `enrichmentWarnings`; say “binding numbers come from the quote.” Use `skipPricingEnrichment: true` in regenerate if needed. |
| ML / Python missing | Response falls back to rules mode — still demo `demoPresentation`. |
| Quote 400 | Check `projectId` matches session; re-run create-session from same generate body. |
| Report 401 | Sign in as **owner** of the project or use ops token for admin tools only. |
| No time for UI | Stay on **curl** + JSON formatter; `demoPresentation` / `format=demo` are slide-ready. |

## After demo

- [ ] Note `recommendationSessionId` / `quoteRequestId` if stakeholders want follow-up.
- [ ] Don’t rely on demo DB for production claims — label as “representative run.”
