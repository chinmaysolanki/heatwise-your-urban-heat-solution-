import type { RuntimeCandidate } from "@/lib/ml/recommendationRuntimeTypes";
import {
  SPECIES_CATALOG_ALIAS_TO_CODE,
  SPECIES_CATALOG_CODES,
} from "@/lib/species/speciesCatalogMapping";
import { ENGINE_PLANT_ID_TO_CATALOG_CODE } from "@/lib/species/enginePlantCatalogLink";
import type { SpeciesIdentityRef } from "@/lib/species/speciesIdentityTypes";

/**
 * Flat alias → code map from ``data/species/species_catalog_mapping.v1.json`` (generated).
 * @deprecated Prefer ``SPECIES_CATALOG_ALIAS_TO_CODE`` from ``speciesCatalogMapping.ts``.
 */
export const SPECIES_LABEL_TO_CATALOG_CODE: Readonly<Record<string, string>> =
  SPECIES_CATALOG_ALIAS_TO_CODE;

export function normalizeSpeciesAliasKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[.]/g, "");
}

function lookupAlias(normalized: string): string | null {
  if (!normalized) return null;
  const direct = SPECIES_CATALOG_ALIAS_TO_CODE[normalized];
  if (direct) return direct;
  const collapsed = normalized.replace(/\s+/g, "");
  for (const [k, code] of Object.entries(SPECIES_CATALOG_ALIAS_TO_CODE)) {
    if (k.replace(/\s+/g, "") === collapsed) return code;
  }
  return null;
}

export function resolveCatalogCodeFromEnginePlantId(enginePlantId: string): SpeciesIdentityRef {
  const code = ENGINE_PLANT_ID_TO_CATALOG_CODE[enginePlantId];
  if (code) {
    return {
      catalogCode: code,
      resolution: "canonical_engine_plant",
      enginePlantId,
    };
  }
  return {
    catalogCode: null,
    resolution: "unresolved",
    enginePlantId,
  };
}

export function resolveCatalogCodeFromMlOrDisplayLabel(rawLabel: string): SpeciesIdentityRef {
  const trimmed = rawLabel.trim();
  if (!trimmed) {
    return { catalogCode: null, resolution: "unresolved", rawLabel: trimmed };
  }
  const norm = normalizeSpeciesAliasKey(trimmed);
  const direct = lookupAlias(norm);
  if (direct) {
    return { catalogCode: direct, resolution: "canonical_alias", rawLabel: trimmed };
  }
  const snake = norm.replace(/\s+/g, "_");
  if (SPECIES_CATALOG_ALIAS_TO_CODE[snake]) {
    return {
      catalogCode: SPECIES_CATALOG_ALIAS_TO_CODE[snake],
      resolution: "canonical_alias",
      rawLabel: trimmed,
    };
  }
  if (SPECIES_CATALOG_CODES.has(snake)) {
    return { catalogCode: snake, resolution: "canonical_alias", rawLabel: trimmed };
  }
  return { catalogCode: null, resolution: "unresolved", rawLabel: trimmed };
}

/**
 * Prefer engine plant identity, then ML primary label. Never promote ambiguous labels to a code.
 */
export function resolveSpeciesIdentity(params: {
  enginePlantId?: string | null;
  mlSpeciesLabel?: string | null;
}): SpeciesIdentityRef {
  if (params.enginePlantId) {
    const fromEngine = resolveCatalogCodeFromEnginePlantId(params.enginePlantId);
    if (fromEngine.catalogCode) return fromEngine;
  }
  if (params.mlSpeciesLabel) {
    const fromMl = resolveCatalogCodeFromMlOrDisplayLabel(params.mlSpeciesLabel);
    if (fromMl.catalogCode) {
      return { ...fromMl, resolution: "ml_payload_resolved" };
    }
    return {
      catalogCode: null,
      resolution: "unresolved",
      enginePlantId: params.enginePlantId ?? undefined,
      rawLabel: params.mlSpeciesLabel,
    };
  }
  if (params.enginePlantId) {
    return resolveCatalogCodeFromEnginePlantId(params.enginePlantId);
  }
  return { catalogCode: null, resolution: "unresolved" };
}

export function resolveSpeciesIdentityFromRuntimeCandidate(
  candidate: RuntimeCandidate,
  enginePlantId?: string | null,
): SpeciesIdentityRef {
  const p = candidate.candidatePayload as Record<string, unknown>;
  const codeRaw = p.species_catalog_code;
  if (typeof codeRaw === "string" && codeRaw.trim()) {
    const mlSpecies = String(p.species_primary ?? "").trim();
    return {
      catalogCode: codeRaw.trim(),
      resolution: "payload_catalog_code",
      rawLabel: mlSpecies || codeRaw.trim(),
      ...(enginePlantId ? { enginePlantId } : {}),
    };
  }
  const mlSpecies = String(p.species_primary ?? "").trim();
  return resolveSpeciesIdentity({
    enginePlantId: enginePlantId ?? null,
    mlSpeciesLabel: mlSpecies || null,
  });
}
