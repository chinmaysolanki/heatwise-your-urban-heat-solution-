/**
 * HeatWise telemetry / training data audit (SQLite + Prisma).
 *
 * Usage (from heatwise/):
 *   DATABASE_URL="file:./dev.db" npx tsx scripts/telemetry-training-audit.ts
 *
 * Note: for SQLite, Prisma resolves `file:` paths relative to the `prisma/` folder → `prisma/dev.db`.
 *   npm run ml:telemetry-audit
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { runTelemetryTrainingAudit } from "@/lib/ml/exportTelemetryPipeline";

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

async function main(): Promise<void> {
  loadDatabaseUrlFromEnvFiles();
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL. Set it or add to .env.local (e.g. file:./dev.db → prisma/dev.db).");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const audit = await runTelemetryTrainingAudit(prisma);
    console.log(JSON.stringify(audit, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
