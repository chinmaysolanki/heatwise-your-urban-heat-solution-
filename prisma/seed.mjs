/**
 * Prisma seed: SpeciesCatalog starter rows (idempotent upsert by `code`).
 *
 * Run: `npx prisma db seed` or `npm run db:seed` from heatwise/
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { SPECIES_CATALOG_SEED } from "./data/species_catalog_seed.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HEATWISE_ROOT = resolve(__dirname, "..");

function loadDatabaseUrlFromEnvFiles() {
  if (process.env.DATABASE_URL) return;
  for (const name of [".env.local", ".env"]) {
    const p = join(HEATWISE_ROOT, name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const m = trimmed.match(/^DATABASE_URL\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[1].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env.DATABASE_URL = v;
      return;
    }
  }
}

function toPrismaSpecies(row) {
  const sun =
    row.maxSunHours == null
      ? null
      : row.maxSunHours >= 8
        ? "FULL"
        : row.maxSunHours <= 4
          ? "PARTIAL"
          : "PARTIAL";

  return {
    displayName: row.displayName,
    scientificName: row.scientificName ?? null,
    category: row.category ?? null,
    edible: row.edible,
    flowering: row.flowering,
    petSafe: row.petSafe,
    droughtTolerant: row.droughtTolerant,
    heatTolerant: row.heatTolerant,
    lowMaintenance: row.lowMaintenance,
    minSunHours: row.minSunHours,
    maxSunHours: row.maxSunHours,
    notes: row.notes ?? null,
    tagsJson: row.tagsJson ?? null,
    droughtTolerance: row.droughtTolerant ? "HIGH" : "MEDIUM",
    sunExposure: sun,
    active: true,
  };
}

async function main() {
  loadDatabaseUrlFromEnvFiles();
  if (!process.env.DATABASE_URL) {
    console.error(
      "Missing DATABASE_URL. Set it or add DATABASE_URL to .env.local in heatwise/.",
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    let n = 0;
    for (const row of SPECIES_CATALOG_SEED) {
      const data = toPrismaSpecies(row);
      await prisma.speciesCatalog.upsert({
        where: { code: row.code },
        create: { code: row.code, ...data },
        update: { ...data },
      });
      n += 1;
    }
    console.log(`SpeciesCatalog: upserted ${n} row(s) by code.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
