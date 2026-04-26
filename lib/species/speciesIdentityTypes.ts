/**
 * Canonical species identity uses Prisma `SpeciesCatalog.code` (snake_case, stable for ML `species_<code>` columns).
 */

export type SpeciesIdentityResolution =
  | "canonical_engine_plant"
  | "canonical_alias"
  | "ml_payload_resolved"
  | "payload_catalog_code"
  | "unresolved";

export type SpeciesIdentityRef = {
  catalogCode: string | null;
  resolution: SpeciesIdentityResolution;
  /** recommendation-engine Plant.id when known */
  enginePlantId?: string;
  /** ML `species_primary` or other runtime label before resolution */
  rawLabel?: string;
};
