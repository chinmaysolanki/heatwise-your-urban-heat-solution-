#!/usr/bin/env node
// Patches prisma/schema.prisma from sqlite → postgresql before Vercel build.
// Only runs when DATABASE_URL starts with "postgres" (i.e. on Vercel with Neon).
const fs = require("fs");
const path = require("path");

const dbUrl = process.env.DATABASE_URL ?? "";
const isVercel = process.env.VERCEL === "1";

// Force postgres patch on Vercel even if DATABASE_URL isn't exposed at patch-time
if (!dbUrl.startsWith("postgres") && !isVercel) {
  console.log("[patch-prisma] DATABASE_URL is not postgres — skipping patch (local sqlite mode).");
  process.exit(0);
}
if (!dbUrl.startsWith("postgres") && isVercel) {
  console.log("[patch-prisma] On Vercel but DATABASE_URL not postgres — patching anyway for runtime.");
}

const directUrl = process.env.DIRECT_URL;
const datasourceBlock = directUrl
  ? `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`
  : `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}`;

const schemaPath = path.join(__dirname, "../prisma/schema.prisma");
let schema = fs.readFileSync(schemaPath, "utf8");

schema = schema.replace(/datasource db \{[\s\S]*?\}/, datasourceBlock);

fs.writeFileSync(schemaPath, schema);
console.log(`[patch-prisma] Patched schema.prisma → postgresql (directUrl: ${directUrl ? "yes" : "no"}) ✓`);
