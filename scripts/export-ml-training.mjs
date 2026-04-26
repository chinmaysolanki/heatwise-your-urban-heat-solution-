/**
 * ML training export → heatwise/ml-models/data/training_export.csv
 *
 * Delegates to lib/ml/trainingExport.js (same logic usable from Next API / jobs).
 *
 * Usage: DATABASE_URL="file:./dev.db" node scripts/export-ml-training.mjs
 * Or: npm run ml:export-training
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { buildTrainingExportCsvString } from "../lib/ml/trainingExport.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HEATWISE_ROOT = resolve(__dirname, "..");
const DEFAULT_OUT = join(HEATWISE_ROOT, "ml-models", "data", "training_export.csv");

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

async function main() {
  loadDatabaseUrlFromEnvFiles();
  if (!process.env.DATABASE_URL) {
    console.error(
      "Missing DATABASE_URL. Set it or add DATABASE_URL to .env.local in heatwise/.",
    );
    process.exit(1);
  }

  const outPath = process.env.ML_TRAINING_EXPORT_PATH
    ? resolve(process.env.ML_TRAINING_EXPORT_PATH)
    : DEFAULT_OUT;

  const prisma = new PrismaClient();
  try {
    const { csv, rowCount, speciesColumnCount } =
      await buildTrainingExportCsvString(prisma);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, csv, "utf8");
    console.log(
      `Wrote ${rowCount} row(s), ${speciesColumnCount} species_<code> targets → ${outPath}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
