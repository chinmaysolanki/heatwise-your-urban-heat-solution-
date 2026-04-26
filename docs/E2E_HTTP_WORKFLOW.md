# HTTP E2E workflow (dev / staging)

End-to-end proof uses real `POST` routes with authentication — no service-layer shortcuts when `HEATWISE_E2E_HTTP=1`.

## Server env (dev/staging)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma |
| `NEXTAUTH_SECRET` | JWT signing for session cookie |
| `HEATWISE_ENABLE_E2E_ISSUER` | Set to `1` to expose `POST /api/e2e/issue-session` |
| `HEATWISE_E2E_ISSUER_SECRET` | Shared secret for issuer (rotate per env) |

**Never set `HEATWISE_ENABLE_E2E_ISSUER=1` on a public production host** without ACL / IP allowlists.

## Client / CI env

| Variable | Purpose |
|----------|---------|
| `HEATWISE_E2E_HTTP=1` | Require full HTTP for generate → create-session → request-quote (no Prisma fallbacks on those steps). |
| `HEATWISE_E2E_BASE_URL` | e.g. `http://localhost:3000` |
| `HEATWISE_E2E_PROJECT_ID` | Existing `Project.id` |
| `HEATWISE_E2E_USER_ID` | Owner `User.id` (must own project for quote) |
| `HEATWISE_E2E_ISSUER_SECRET` | Same value as server `HEATWISE_E2E_ISSUER_SECRET` |
| **Optional** `HEATWISE_E2E_SESSION_COOKIE` | Skip issuer if you already have a `next-auth.session-token=…` pair |
| **Extended** `HEATWISE_E2E_EXTENDED=1` | Also run assign → submit-quote → accept-job over HTTP (needs ops + installer). |
| `HEATWISE_E2E_OPS_TOKEN` | Same as server `HEATWISE_OPS_TOKEN` |
| `HEATWISE_E2E_INSTALLER_ID` | `InstallerProfile.id` whose `serviceRegionsJson` matches assign `matchContext.region` |
| **Optional** `HEATWISE_E2E_VERIFIED_JSON` | Path to JSON body for `submit-verified-install` (script injects `installJobId`). Use per-installer keys env below. |
| `HEATWISE_E2E_INSTALLER_KEYS_JSON` | Client copy of `{"<installerId>":"<secret>"}` matching server `HEATWISE_INSTALLER_PORTAL_KEYS_JSON` |

## Example: strict HTTP through quote

```bash
cd heatwise
export HEATWISE_ENABLE_E2E_ISSUER=1
export HEATWISE_E2E_ISSUER_SECRET='dev-only'
export NEXTAUTH_SECRET='...'  # already required for NextAuth
npm run dev
```

Second shell:

```bash
cd heatwise
export HEATWISE_E2E_HTTP=1
export HEATWISE_E2E_BASE_URL=http://localhost:3000
export HEATWISE_E2E_PROJECT_ID='...'
export HEATWISE_E2E_USER_ID='...'
export HEATWISE_E2E_ISSUER_SECRET='dev-only'
npm run e2e:workflow
```

**Expected:** JSON with `"mode":"http_strict"`, `recommendationSessionId`, `quoteRequestId`, `generateMode`, and no service-layer warnings.

## Example: extended chain + verified install

1. Prepare `verified.json` with all required fields **except** `installJobId` (the script overwrites it).
2. Server must have `HEATWISE_INSTALLER_PORTAL_KEYS_JSON` matching client `HEATWISE_E2E_INSTALLER_KEYS_JSON`.

```bash
export HEATWISE_E2E_EXTENDED=1
export HEATWISE_E2E_VERIFIED_JSON=./scripts/fixtures/e2e-verified-install.json
export HEATWISE_E2E_INSTALLER_KEYS_JSON='{"clxyz123":"installer-secret"}'
npm run e2e:workflow
```

**Expected:** `report.extended.installJobId`, `installerQuoteId`, and `verifiedInstallId` when JSON path set.

## Manual issuer call

```bash
curl -sS -D - -X POST "$BASE/api/e2e/issue-session" \
  -H 'Content-Type: application/json' \
  -H "x-heatwise-e2e-issuer-secret: $HEATWISE_E2E_ISSUER_SECRET" \
  -d '{"userId":"'"$USER_ID"'"}'
```

Use the `Set-Cookie` line as `Cookie` for `/api/installers/request-quote`.

## Operational checks

```bash
npm run workflow:checks    # typecheck + enrichment tests + ML smoke + serving readiness JSON
npm run ml:serving-readiness -- --strict   # fails if registry incomplete (requires HEATWISE_REGISTRY_DIR)
```
