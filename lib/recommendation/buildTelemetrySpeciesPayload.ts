/**
 * Build species snapshot for RecommendationCandidateSnapshot.speciesPayloadJson (Phase 5/6).
 */

const SPECIES_PAYLOAD_SCHEMA = "hw_species_identity_v1";

export function extractSpeciesCatalogCodesFromRecommendation(rec: unknown): string[] {
  const codes = new Set<string>();
  if (!rec || typeof rec !== "object") return [];
  const r = rec as Record<string, unknown>;

  const primary = r.primarySpeciesIdentity as { catalogCode?: string | null } | undefined;
  if (primary?.catalogCode) codes.add(primary.catalogCode);

  const cand = r.candidate as
    | { scoredPlants?: Array<{ plant?: { speciesCatalogCode?: string | null } }> }
    | undefined;
  for (const sp of cand?.scoredPlants ?? []) {
    const c = sp.plant?.speciesCatalogCode;
    if (typeof c === "string" && c.length > 0) codes.add(c);
  }

  const layout = r.layoutSchema as
    | { placedPlants?: Array<{ speciesCatalogCode?: string | null }> }
    | undefined;
  for (const p of layout?.placedPlants ?? []) {
    if (typeof p.speciesCatalogCode === "string" && p.speciesCatalogCode.length > 0) {
      codes.add(p.speciesCatalogCode);
    }
  }

  return [...codes];
}

export function buildSpeciesPayloadForTelemetrySnapshot(rec: unknown): Record<string, unknown> {
  const speciesCatalogCodes = extractSpeciesCatalogCodesFromRecommendation(rec);
  const r = rec as {
    primarySpeciesIdentity?: {
      catalogCode?: string | null;
      resolution?: string;
      rawLabel?: string | null;
    };
  };
  const primary = r.primarySpeciesIdentity;
  return {
    schema: SPECIES_PAYLOAD_SCHEMA,
    speciesCatalogCodes,
    primaryCatalogCode: primary?.catalogCode ?? speciesCatalogCodes[0] ?? null,
    primaryResolution: primary?.resolution ?? null,
    rawLabel: primary?.rawLabel ?? null,
  };
}
