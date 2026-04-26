/**
 * Build `data/species/species_catalog_mapping.v1.json` from
 * `prisma/data/species_catalog_seed.mjs` + `prisma/data/species_alias_extensions.json`.
 *
 * Run:
 *   node scripts/generate-species-catalog-mapping.mjs           # write artifact
 *   node scripts/generate-species-catalog-mapping.mjs --check   # fail if stale/missing
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SPECIES_CATALOG_SEED } from "../prisma/data/species_catalog_seed.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_FILE = join(ROOT, "data/species/species_catalog_mapping.v1.json");

/** @param {string} raw */
function normalizeSpeciesAliasKey(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[.]/g, "");
}

/** @param {Map<string, string>} map @param {string} aliasRaw @param {string} code */
function putAlias(map, aliasRaw, code) {
  const k = normalizeSpeciesAliasKey(aliasRaw);
  if (!k) return;
  const prev = map.get(k);
  if (prev !== undefined && prev !== code) {
    console.warn(
      `[species-mapping] alias key "${k}" maps to both "${prev}" and "${code}" — later merge wins`,
    );
  }
  map.set(k, code);
}

/** @returns {Map<string, string>} */
function aliasesfromSeed() {
  const map = new Map();
  for (const row of SPECIES_CATALOG_SEED) {
    const code = row.code;
    putAlias(map, code, code);
    putAlias(map, row.displayName, code);
    if (row.scientificName) putAlias(map, row.scientificName, code);
    const d = row.displayName;
    const paren = d.indexOf("(");
    if (paren > 0) {
      putAlias(map, d.slice(0, paren).trim(), code);
    }
  }
  return map;
}

/** Snapshot used for --check (excludes generatedAt). */
function checksumPayload(artifact) {
  return {
    version: artifact.version,
    source: artifact.source,
    canonicalCodes: artifact.canonicalCodes,
    aliasToCode: artifact.aliasToCode,
    species: artifact.species,
    speciesFeatureKeyAliases: artifact.speciesFeatureKeyAliases ?? {},
    speciesFeatureKeysExcludeFromCatalogHybrid: artifact.speciesFeatureKeysExcludeFromCatalogHybrid ?? [],
  };
}

function stableStringify(obj) {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

/** @returns {object} full artifact including generatedAt */
function buildSpeciesCatalogArtifact() {
  const extPath = join(ROOT, "prisma/data/species_alias_extensions.json");
  const extJson = JSON.parse(readFileSync(extPath, "utf8"));
  const extMap = extJson.aliasToCode;
  if (!extMap || typeof extMap !== "object") {
    throw new Error("species_alias_extensions.json must contain aliasToCode object");
  }

  const map = aliasesfromSeed();
  for (const [alias, code] of Object.entries(extMap)) {
    if (typeof code !== "string") continue;
    putAlias(map, alias, code);
  }

  const aliasToCode = Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
  const canonicalCodes = [...new Set(SPECIES_CATALOG_SEED.map((r) => r.code))].sort();

  const aliasesByCode = new Map();
  for (const [alias, code] of map.entries()) {
    if (!aliasesByCode.has(code)) aliasesByCode.set(code, []);
    aliasesByCode.get(code).push(alias);
  }
  for (const [, arr] of aliasesByCode) arr.sort((a, b) => a.localeCompare(b));

  /** @type {{ code: string; displayName: string; scientificName?: string; aliases: string[] }} */
  const species = SPECIES_CATALOG_SEED.map((r) => ({
    code: r.code,
    displayName: r.displayName,
    ...(r.scientificName ? { scientificName: r.scientificName } : {}),
    aliases: aliasesByCode.get(r.code) ?? [],
  }));

  let speciesFeatureKeyAliases = {};
  const rawSf = extJson.speciesFeatureKeyAliases;
  if (rawSf && typeof rawSf === "object") {
    speciesFeatureKeyAliases = Object.fromEntries(
      Object.entries(rawSf)
        .filter(([, v]) => typeof v === "string")
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  }

  const rawEx = extJson.speciesFeatureKeysExcludeFromCatalogHybrid;
  let speciesFeatureKeysExcludeFromCatalogHybrid = [];
  if (Array.isArray(rawEx)) {
    speciesFeatureKeysExcludeFromCatalogHybrid = [...new Set(rawEx.filter((x) => typeof x === "string" && x.trim()))]
      .map((s) => s.trim())
      .sort((a, b) => a.localeCompare(b));
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      seedModule: "prisma/data/species_catalog_seed.mjs",
      extensionsFile: "prisma/data/species_alias_extensions.json",
    },
    canonicalCodes,
    aliasToCode,
    species,
    speciesFeatureKeyAliases,
    speciesFeatureKeysExcludeFromCatalogHybrid,
  };
}

function writeArtifact() {
  const artifact = buildSpeciesCatalogArtifact();
  const outDir = join(ROOT, "data/species");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(OUT_FILE, stableStringify(artifact), "utf8");
  console.log(
    `Wrote ${OUT_FILE} (${Object.keys(artifact.aliasToCode).length} aliases, ${artifact.canonicalCodes.length} codes)`,
  );
}

function checkArtifact() {
  let committedRaw;
  try {
    committedRaw = readFileSync(OUT_FILE, "utf8");
  } catch {
    console.error(
      `[species-mapping --check] Missing artifact: ${OUT_FILE}\n` +
        "  Generate with: npm run gen:species-mapping\n" +
        "  Deployments must include data/species/species_catalog_mapping.v1.json for Python serving.",
    );
    process.exit(1);
    return;
  }

  let committedParsed;
  try {
    committedParsed = JSON.parse(committedRaw);
  } catch (e) {
    console.error(`[species-mapping --check] Invalid JSON in committed artifact: ${OUT_FILE}`, e);
    process.exit(1);
    return;
  }

  const fresh = buildSpeciesCatalogArtifact();
  const a = stableStringify(checksumPayload(committedParsed));
  const b = stableStringify(checksumPayload(fresh));

  if (a !== b) {
    console.error(
      "[species-mapping --check] Committed artifact is stale or differs from generator output.\n" +
        "  Regenerate: npm run gen:species-mapping\n" +
        "  Then commit data/species/species_catalog_mapping.v1.json",
    );
    process.exit(1);
    return;
  }

  console.log("[species-mapping --check] OK (artifact matches seed + extensions)");
}

const argv = process.argv.slice(2);
if (argv.includes("--check")) {
  checkArtifact();
} else {
  writeArtifact();
}
