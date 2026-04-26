/**
 * Defaults for persisting geo + supply constraint snapshots used in dossier/report provenance.
 *
 * Explicit env always wins:
 * - `HEATWISE_PERSIST_GEO_ENRICHMENT=1|0`
 * - `HEATWISE_PERSIST_CONSTRAINT_SNAPSHOT=1|0`
 *
 * When unset: **persist when `projectId` is present** and runtime is not plain `development`
 * (`NODE_ENV === "production"` OR `HEATWISE_ENV` is `staging` / `production`), so staging/prod
 * get linked snapshots by default; local dev stays ephemeral unless forced.
 *
 * **Safety / staging:** If `NODE_ENV !== "production"` and `HEATWISE_ENV` is unset, persistence
 * defaults to **off** (treated like local dev). For staging-like behavior on a non-prod Node
 * process, set `HEATWISE_ENV=staging` explicitly—do not rely on host name alone.
 *
 * **Dossier gaps:** Geo/constraint snapshots are never written without `projectId` on the generate
 * request; callers receive `enrichmentWarnings` with `PERSIST_SKIPPED_NO_PROJECT_ID` when
 * persistence policy is on but `projectId` is missing.
 */
function envTriState(name: string): boolean | null {
  const v = (process.env[name] ?? "").trim();
  if (v === "1" || v.toLowerCase() === "true") return true;
  if (v === "0" || v.toLowerCase() === "false") return false;
  return null;
}

function isNonDevRuntime(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const he = (process.env.HEATWISE_ENV ?? "").trim().toLowerCase();
  return he === "staging" || he === "production";
}

/** When true and `projectId` is set on generate, geo chain may be written to Prisma. */
export function shouldPersistGeoEnrichment(): boolean {
  const e = envTriState("HEATWISE_PERSIST_GEO_ENRICHMENT");
  if (e !== null) return e;
  return isNonDevRuntime();
}

/** When true and `projectId` is set on generate, supply constraint snapshot may be written. */
export function shouldPersistConstraintSnapshot(): boolean {
  const e = envTriState("HEATWISE_PERSIST_CONSTRAINT_SNAPSHOT");
  if (e !== null) return e;
  return isNonDevRuntime();
}
