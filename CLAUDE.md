# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev                      # Start Next.js dev server
npm run lint                     # ESLint
npm run typecheck                # TypeScript type checking (tsc --noEmit)

# Database
npx prisma migrate deploy        # Apply migrations
npm run db:seed                  # Seed database
npm run db:migrate               # Run migrations

# Species catalog (must run after changing seed/aliases, commit result)
npm run gen:species-mapping      # Regenerate data/species/species_catalog_mapping.v1.json
npm run check:species-mapping    # Verify mapping artifact (runs in CI)

# Testing
npm run test:recommendation      # Recommendation engine integration tests (requires DATABASE_URL + seeded DB)
npm run ml:serving-smoke         # ML serving smoke test

# Android (see ANDROID.md for emulator/USB/Wi-Fi setup)
npm run dev:android              # Dev server for Android
npm run android:sync             # Sync Capacitor
npm run android:studio           # Open Android Studio
```

## CI

On every push/PR to main, CI runs:
1. `npm run check:species-mapping` — verifies the generated mapping artifact is committed and up to date
2. `npm run typecheck` — TypeScript validation

## Architecture

### Framework & Stack
- **Next.js (Pages Router)** — all pages and API routes live in `pages/`
- **Prisma + SQLite** (local dev) / Postgres (production) — schema in `prisma/schema.prisma` (55+ models)
- **NextAuth** — phone OTP auth (`lib/phoneOtp.ts`, `/api/phone-auth/`)
- **Capacitor** — Android shell in `heatwise-native/`, WebView pointed at `CAP_SERVER_URL`

### Path Aliases
- `@/*` → root
- `@/models` → `./models`
- `@/ar` → `./src/ar`
- `@/live-ar/*` → `./src/live-ar/*`

### Recommendation Engine (`lib/recommendation/`)
The core intelligence of the app. Entry point: `orchestrateLayoutRecommendations.ts`. It runs a hybrid strategy:
1. **ML model** — served via Python process, integrated in `mergeMlIntoLayoutRecommendations.ts`
2. **Catalog hybrid fallback** — rules-based (`catalogHybridFallback.ts`, largest file at 37KB)
3. **Rules-only fallback** — `rulesOnlyFallback.ts`

Eligibility filtering happens in `layoutEligibility.ts` before candidates reach scoring.

### Telemetry & Observability (Phase 8-9 architecture)
- `RecommendationTelemetrySession` — immutable snapshot per request (modelVersion, rulesVersion)
- `RecommendationCandidateSnapshot` — exact candidate card shown (rank, score, cost)
- `RecommendationTelemetryEvent` — append-only user/installer signals
- `RecommendationRuntimeObservation` — rollout metrics and guardrail failures

All telemetry is **immutable and append-only** — never update existing rows.

### Species Catalog
- `data/species/species_catalog_mapping.v1.json` — **generated artifact**, must be committed
- Source of truth lives in `lib/species/speciesCatalogMapping.ts` and the seed data
- `lib/species/resolveSpeciesCatalogCode.ts` — runtime resolution
- `SpeciesCatalog` Prisma model — canonical plant species with trait indices and ML tags

### Domain Model (`models/index.ts`)
Core enums: `SpaceType`, `SunExposure`, `WindLevel`, `BudgetRange`, `MaintenanceLevel`, `UserGoal`, `LayoutType`, `PlantType`, `Confidence`
Core interfaces: `ProjectInput`, `SpaceGeometry`, `Plant`, `CoolingModule`, `LayoutTemplate`, `Candidate`, `Recommendation`, `ScoringWeights`

### ML Integration (`lib/ml/`, `ml/`)
- `lib/ml/exportTelemetryPipeline.ts` — exports training data from telemetry
- `ml/` — Python serving scripts, model registry (`ml/registry/`), species CSV bootstrap data
- ML process config via env vars: `HEATWISE_ML_CWD`, `HEATWISE_REGISTRY_DIR`, `HEATWISE_SPECIES_CSV`

### AR / Visualization (`src/ar/`, `src/live-ar/`)
- Three.js-based live AR with WebGL canvas
- `src/live-ar/` — tracking, geometry, perspective math, adapters
- `src/services/arCameraService` — camera integration

### Key API Routes
- `POST /api/recommendations/generate` — main recommendation endpoint
- `GET/POST /api/projects/[id]` — project CRUD
- `/api/geospatial/` — site enrichment, microclimate, exposure
- `/api/supply/` — species/material availability
- `/api/installers/` — quote request/response/assignment
- `/api/admin/` — metrics, experiments, rollout monitoring
- `/api/commercial/` — funnel and unit economics

## Environment Variables

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
OPENAI_API_KEY=...
HEATWISE_DEV_OTP=false           # Set true to log OTP codes to console instead of SMS/email
# Email OTP (SMTP) — only needed in production; dev mode logs OTPs to console
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=hello@heatwise.in
SMTP_PASS=...
SMTP_FROM=hello@heatwise.in
HEATWISE_ADMIN_EMAILS=           # Comma-separated admin emails
CAP_SERVER_URL=http://localhost:3000   # Android WebView target
HEATWISE_DEV_EXTRA_ORIGINS=      # Extra allowed dev origins (comma-separated)
HEATWISE_ML_CWD=./ml
HEATWISE_REGISTRY_DIR=./ml/registry
HEATWISE_SPECIES_CSV=./ml/data/bootstrap/sample_outputs/demo_pack/species_features.csv
```

## Android Dev Notes

The Next.js dev server allows `10.0.2.2` (Android emulator loopback) and `localhost` by default. For physical devices or custom IPs, add to `HEATWISE_DEV_EXTRA_ORIGINS`. See `ANDROID.md` for `adb reverse` setup.
