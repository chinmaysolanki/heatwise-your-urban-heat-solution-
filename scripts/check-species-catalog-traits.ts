/**
 * Validate SpeciesCatalog trait quality for catalogHybridFallback.
 *
 * Default: validates prisma/data/species_catalog_seed.mjs rows (same shape as DB after seed).
 *   npx tsx scripts/check-species-catalog-traits.ts
 *
 * Optional: read live DB (requires DATABASE_URL):
 *   npx tsx scripts/check-species-catalog-traits.ts --db
 */

import process from "node:process";

import { db } from "@/lib/db";
import {
  partitionTraitIssues,
  validateSpeciesTraitRows,
  type SpeciesTraitQualityRow,
} from "@/lib/species/speciesCatalogTraitQuality";
import { speciesSeedRowToTraitSnapshot } from "@/lib/species/speciesSeedTraitSnapshot";
import { SPECIES_CATALOG_SEED } from "../prisma/data/species_catalog_seed.mjs";

async function snapshotsFromDb(): Promise<SpeciesTraitQualityRow[]> {
  const rows = await db.speciesCatalog.findMany({
    where: { active: true },
    select: {
      code: true,
      droughtTolerance: true,
      droughtTolerant: true,
      minSunHours: true,
      maxSunHours: true,
      petSafe: true,
      edible: true,
      category: true,
      sunExposure: true,
    },
    orderBy: { code: "asc" },
  });
  return rows.map((r) => ({
    code: r.code,
    droughtTolerance: r.droughtTolerance ?? null,
    droughtTolerant: r.droughtTolerant,
    minSunHours: r.minSunHours ?? null,
    maxSunHours: r.maxSunHours ?? null,
    petSafe: r.petSafe,
    edible: r.edible,
    category: r.category ?? null,
    sunExposure: r.sunExposure ?? null,
  }));
}

async function main(): Promise<void> {
  const useDb = process.argv.includes("--db");
  let snapshots: SpeciesTraitQualityRow[];

  if (useDb) {
    try {
      snapshots = await snapshotsFromDb();
    } finally {
      await db.$disconnect().catch(() => {});
    }
  } else {
    snapshots = SPECIES_CATALOG_SEED.map((row) => speciesSeedRowToTraitSnapshot(row));
  }

  const issues = validateSpeciesTraitRows(snapshots);
  const { errors, warns } = partitionTraitIssues(issues);

  for (const w of warns) {
    console.warn(`[warn] ${w.code}: ${w.message}`);
  }

  if (errors.length > 0) {
    for (const e of errors) {
      console.error(`[error] ${e.code}: ${e.message}`);
    }
    console.error(`\nSpecies trait validation failed: ${errors.length} error(s), ${warns.length} warning(s).`);
    process.exit(1);
  }

  console.log(
    `Species trait validation OK (${snapshots.length} row(s), ${warns.length} warning(s), source=${useDb ? "db" : "seed"}).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
