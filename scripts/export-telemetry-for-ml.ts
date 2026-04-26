/**
 * Export Prisma telemetry tables → JSONL + CSV for ml/live_data (export_feedback_dataset / export_training_dataset).
 *
 * Usage (from heatwise/):
 *   DATABASE_URL="file:./dev.db" npx tsx scripts/export-telemetry-for-ml.ts --out ml/live_data/dumps/latest
 *
 * SQLite paths are relative to the `prisma/` directory (`file:./dev.db` → `prisma/dev.db`).
 *   npm run ml:export-telemetry-pipeline
 *
 * Flags:
 *   --out <dir>          Output root (default: ml/live_data/dumps/latest)
 *   --no-legacy-bridge   Omit RecommendationFeedbackEvent bridge rows
 *   --no-csv             JSONL only
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { exportTelemetryPipelineForMl } from "@/lib/ml/exportTelemetryPipeline";

const __root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadDatabaseUrlFromEnvFiles(): void {
  if (process.env.DATABASE_URL) return;
  for (const name of [".env.local", ".env"]) {
    const p = join(__root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const m = t.match(/^DATABASE_URL\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env.DATABASE_URL = v;
      return;
    }
  }
}

function parseArgs(argv: string[]) {
  let outDir = join(__root, "ml/live_data/dumps/latest");
  let includeLegacyBridge = true;
  let writeCsv = true;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out" && argv[i + 1]) {
      outDir = resolve(__root, argv[++i]);
    } else if (argv[i] === "--no-legacy-bridge") {
      includeLegacyBridge = false;
    } else if (argv[i] === "--no-csv") {
      writeCsv = false;
    }
  }
  return { outDir, includeLegacyBridge, writeCsv };
}

async function main(): Promise<void> {
  loadDatabaseUrlFromEnvFiles();
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL.");
    process.exit(1);
  }

  const { outDir, includeLegacyBridge, writeCsv } = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const { jsonlDir, csvDir } = await exportTelemetryPipelineForMl(prisma, {
      outDir,
      includeLegacyBridge,
      writeCsv,
    });
    console.log(JSON.stringify({ outDir, jsonlDir, csvDir, includeLegacyBridge, writeCsv }, null, 2));
    console.error(
      "\nNext: cd ml/live_data && python exporters/export_training_dataset.py \\",
    );
    console.error(`  --feedback-csv-dir "${csvDir}" \\`);
    console.error(`  --output-dir "${join(outDir, "training")}"`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
