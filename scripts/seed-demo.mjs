/**
 * Idempotent demo user + projects for HeatWise presenter flows.
 *
 * Run: `npm run demo:seed` (from heatwise/)
 *
 * After seed, set in .env.local for smoke + docs:
 *   HEATWISE_DEMO_USER_EMAIL=demo@heatwise.local
 *   HEATWISE_DEMO_PROJECT_ROOFTOP_ID=<printed id>
 *   HEATWISE_DEMO_PROJECT_TERRACE_ID=<printed id>
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

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

const DEMO_EMAIL = (process.env.HEATWISE_DEMO_USER_EMAIL ?? "demo@heatwise.local").trim();
const ROOFTOP_NAME = "Demo — Rooftop (Bengaluru)";
const TERRACE_NAME = "Demo — Terrace (Bengaluru)";

async function main() {
  loadDatabaseUrlFromEnvFiles();
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL. Set it or add to .env.local.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      create: {
        email: DEMO_EMAIL,
        name: "Demo Presenter",
        city: "Bengaluru",
        state: "KA",
        country: "IN",
      },
      update: {
        name: "Demo Presenter",
        city: "Bengaluru",
        state: "KA",
        country: "IN",
      },
    });

    let rooftop = await prisma.project.findFirst({
      where: { userId: user.id, name: ROOFTOP_NAME },
    });
    if (!rooftop) {
      rooftop = await prisma.project.create({
        data: {
          userId: user.id,
          name: ROOFTOP_NAME,
          location: "Indiranagar, Bengaluru",
          surfaceType: "Rooftop",
          primaryGoal: "cooling",
          area: 42,
          obstacles: "demo_seed",
          status: "Draft",
        },
      });
    }

    let terrace = await prisma.project.findFirst({
      where: { userId: user.id, name: TERRACE_NAME },
    });
    if (!terrace) {
      terrace = await prisma.project.create({
        data: {
          userId: user.id,
          name: TERRACE_NAME,
          location: "Koramangala, Bengaluru",
          surfaceType: "Terrace",
          primaryGoal: "cooling",
          area: 28,
          obstacles: "demo_seed",
          status: "Draft",
        },
      });
    }

    let rSpace = await prisma.space.findFirst({
      where: { projectId: rooftop.id, name: "Main rooftop" },
    });
    if (!rSpace) {
      rSpace = await prisma.space.create({
        data: {
          projectId: rooftop.id,
          name: "Main rooftop",
          spaceKind: "ROOFTOP",
          lengthM: 7,
          widthM: 6,
          floorLevel: 4,
          waterAccess: "yes",
          drainageQuality: "good",
        },
      });
    }

    let tSpace = await prisma.space.findFirst({
      where: { projectId: terrace.id, name: "Terrace garden" },
    });
    if (!tSpace) {
      tSpace = await prisma.space.create({
        data: {
          projectId: terrace.id,
          name: "Terrace garden",
          spaceKind: "ROOFTOP",
          lengthM: 7,
          widthM: 4,
          floorLevel: 2,
          waterAccess: "limited",
          drainageQuality: "fair",
        },
      });
    }

    console.log("--- Demo seed OK ---");
    console.log("HEATWISE_DEMO_USER_EMAIL=" + DEMO_EMAIL);
    console.log("HEATWISE_DEMO_USER_ID=" + user.id);
    console.log("HEATWISE_DEMO_PROJECT_ROOFTOP_ID=" + rooftop.id);
    console.log("HEATWISE_DEMO_PROJECT_TERRACE_ID=" + terrace.id);
    console.log("(optional) SPACE_ROOFTOP_ID=" + rSpace.id);
    console.log("(optional) SPACE_TERRACE_ID=" + tSpace.id);
    console.log("");
    console.log("Sign in: use /api/e2e/issue-session with this user's email (dev) or your auth provider.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
