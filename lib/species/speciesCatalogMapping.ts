import type { SpeciesCatalogMappingV1 } from "@/lib/species/speciesCatalogMappingTypes";
import speciesCatalogMappingJson from "@/data/species/species_catalog_mapping.v1.json";

function validateSpeciesCatalogMappingPayload(data: unknown): SpeciesCatalogMappingV1 {
  if (data === null || typeof data !== "object") {
    throw new Error(
      "[speciesCatalogMapping] Invalid or missing data/species/species_catalog_mapping.v1.json. " +
        "Run `npm run gen:species-mapping` from the HeatWise app root and ensure the file is committed " +
        "(required for Next.js build and species resolution).",
    );
  }
  const d = data as SpeciesCatalogMappingV1;
  if (!Array.isArray(d.canonicalCodes) || d.canonicalCodes.length === 0) {
    throw new Error(
      "[speciesCatalogMapping] Artifact has no canonicalCodes. Regenerate: npm run gen:species-mapping",
    );
  }
  if (!d.aliasToCode || typeof d.aliasToCode !== "object" || Object.keys(d.aliasToCode).length === 0) {
    throw new Error(
      "[speciesCatalogMapping] Artifact has no aliasToCode. Regenerate: npm run gen:species-mapping",
    );
  }
  if (typeof d.version !== "number") {
    throw new Error("[speciesCatalogMapping] Artifact missing version. Regenerate: npm run gen:species-mapping");
  }
  return d;
}

/** Runtime load of the build-generated species identity artifact (Phase 11–12). */
export const SPECIES_CATALOG_MAPPING_V1: SpeciesCatalogMappingV1 = validateSpeciesCatalogMappingPayload(
  speciesCatalogMappingJson,
);

export const SPECIES_CATALOG_ALIAS_TO_CODE: Readonly<Record<string, string>> =
  SPECIES_CATALOG_MAPPING_V1.aliasToCode;

export const SPECIES_CATALOG_CODES: ReadonlySet<string> = new Set(
  SPECIES_CATALOG_MAPPING_V1.canonicalCodes,
);
