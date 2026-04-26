# HeatWise

Next.js (pages router) + Prisma + NextAuth + Capacitor Android shell.

## Species catalog mapping (generated)

Canonical species aliases and CSV key overrides live in **`data/species/species_catalog_mapping.v1.json`**, built from `prisma/data/species_catalog_seed.mjs` and `prisma/data/species_alias_extensions.json`.

- After changing the seed or alias extensions: run **`npm run gen:species-mapping`** and commit the updated JSON.
- Verify **`npm run check:species-mapping`** (also part of **`npm run check:workflow`**): fails if the committed artifact is missing or stale.
- Python **`python -m serving`** requires that file under the HeatWise app root (or set **`HEATWISE_SPECIES_MAPPING_JSON`**). Include `data/species/` in deployment artifacts.

### Recommendation runtime tests

```bash
export DATABASE_URL="file:./prisma/dev.db"
npm run db:seed   # ensures SpeciesCatalog rows for catalog-hybrid tests
npm run test:recommendation
```

Includes **API/orchestration E2E** for `POST /api/recommendations/generate` (handler in-process, layout slate + fallback assertions). Details: **[lib/recommendation/testing/README.md](./lib/recommendation/testing/README.md)**

## Web (local)

```bash
npm install
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Android Studio

See **[ANDROID.md](./ANDROID.md)** for USB / emulator / Wi‑Fi, `adb reverse`, `CAP_SERVER_URL`, and `NEXTAUTH_URL`.

```bash
# Terminal 1
npm run dev:android

# Terminal 2 — physical device over USB: adb reverse tcp:3000 tcp:3000
npm run android:studio
```

Open the project Android Studio loads: `heatwise-native/android` → Run ▶.
