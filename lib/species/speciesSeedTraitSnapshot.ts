/**
 * Map `SPECIES_CATALOG_SEED` rows to the same trait snapshot shape Prisma seed writes,
 * so validation matches runtime DB content after `prisma db seed`.
 *
 * Keep in sync with `prisma/seed.mjs` → `toPrismaSpecies`.
 */

import type { SpeciesTraitQualityRow } from "@/lib/species/speciesCatalogTraitQuality";

export type SpeciesSeedRowLike = {
  code: string;
  category?: string;
  edible: boolean;
  petSafe: boolean;
  droughtTolerant: boolean;
  minSunHours: number | null;
  maxSunHours: number | null;
};

export function speciesSeedRowToTraitSnapshot(row: SpeciesSeedRowLike): SpeciesTraitQualityRow {
  const sun =
    row.maxSunHours == null
      ? null
      : row.maxSunHours >= 8
        ? "FULL"
        : row.maxSunHours <= 4
          ? "PARTIAL"
          : "PARTIAL";

  return {
    code: row.code,
    droughtTolerance: row.droughtTolerant ? "HIGH" : "MEDIUM",
    droughtTolerant: row.droughtTolerant,
    minSunHours: row.minSunHours,
    maxSunHours: row.maxSunHours,
    petSafe: row.petSafe,
    edible: row.edible,
    category: row.category ?? null,
    sunExposure: sun,
  };
}
