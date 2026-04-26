export type SpeciesCatalogMappingV1 = {
  version: number;
  generatedAt: string;
  source: { seedModule: string; extensionsFile: string };
  canonicalCodes: string[];
  aliasToCode: Record<string, string>;
  /** Legacy ``species_key`` values from species_features CSV → ``SpeciesCatalog.code`` (catalog-hybrid path). */
  speciesFeatureKeyAliases?: Record<string, string>;
  /** Raw CSV ``species_key`` values omitted from catalog-hybrid merge (training-only / quarantined). */
  speciesFeatureKeysExcludeFromCatalogHybrid?: string[];
  species: Array<{
    code: string;
    displayName: string;
    scientificName?: string;
    aliases: string[];
  }>;
};
