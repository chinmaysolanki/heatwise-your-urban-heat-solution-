/**
 * ML training CSV: canonical feature column order and row shaping.
 * No IDs or timestamps — safe for denormalized export from RecommendationRun trees.
 */

/** @type {readonly string[]} */
export const TRAINING_FEATURE_COLUMNS = [
  "space_type",
  "area_sqm",
  "length_m",
  "width_m",
  "sunlight_hours",
  "shade_level",
  "wind_exposure",
  "water_access",
  "drainage_quality",
  "avg_day_temp_c",
  "peak_surface_temp_c",
  "humidity_pct",
  "rainfall_level",
  "heat_island_score",
  "maintenance_level",
  "budget_level",
  "preferred_style",
  "edible_preference",
  "flowering_preference",
  "pet_safe_required",
  "irrigation_allowed",
];

function numOrEmpty(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "";
  return String(v);
}

function boolOrEmpty(v) {
  if (v === null || v === undefined) return "";
  return v ? "1" : "0";
}

/**
 * Multi-label positives from operational labels only (no rank, no candidate id exported).
 * @param {{ candidates?: Array<{ accepted?: boolean, installed?: boolean, species?: { code?: string } | null }> }} run
 * @returns {Set<string>}
 */
export function collectPositiveSpeciesCodesFromAcceptInstall(run) {
  const positive = new Set();
  for (const c of run.candidates ?? []) {
    if (!(c.accepted || c.installed)) continue;
    const code = c.species?.code;
    if (code) positive.add(code);
  }
  return positive;
}

/**
 * @param {{
 *   environmentSnapshot?: Record<string, unknown> | null
 *   space?: Record<string, unknown> | null
 *   userPreference?: Record<string, unknown> | null
 *   project?: { primaryGoal?: string | null } | null
 * }} run
 */
export function buildTrainingFeatureRecord(run) {
  const snap = run.environmentSnapshot ?? null;
  const space = run.space ?? snap?.space ?? null;
  const pref = run.userPreference ?? null;
  const project = run.project ?? null;

  const spaceType =
    space &&
    `${String(space.spaceKind ?? "").trim()}_${space.indoor ? "indoor" : "outdoor"}`;

  return {
    space_type: spaceType || "",
    area_sqm: numOrEmpty(space?.areaSqm),
    length_m: numOrEmpty(space?.lengthM),
    width_m: numOrEmpty(space?.widthM),
    sunlight_hours: numOrEmpty(snap?.sunlightHours),
    shade_level: snap?.shadeLevel != null ? String(snap.shadeLevel) : "",
    wind_exposure: numOrEmpty(snap?.windIndex),
    water_access: space?.waterAccess != null ? String(space.waterAccess) : "",
    drainage_quality:
      space?.drainageQuality != null ? String(space.drainageQuality) : "",
    avg_day_temp_c: numOrEmpty(snap?.tempC),
    peak_surface_temp_c: numOrEmpty(snap?.peakSurfaceTempC),
    humidity_pct: numOrEmpty(snap?.humidityPct),
    rainfall_level:
      snap?.rainfallLevel != null ? String(snap.rainfallLevel) : "",
    heat_island_score: numOrEmpty(snap?.heatIslandScore),
    maintenance_level: numOrEmpty(pref?.maintenanceBand),
    budget_level: numOrEmpty(pref?.budgetBand),
    preferred_style:
      (pref?.preferredStyle != null && String(pref.preferredStyle).trim()) ||
      (project?.primaryGoal != null ? String(project.primaryGoal) : "") ||
      "",
    edible_preference: boolOrEmpty(pref?.ediblePreference),
    flowering_preference: boolOrEmpty(pref?.floweringPreference),
    pet_safe_required: boolOrEmpty(pref?.petSafeRequired),
    irrigation_allowed: boolOrEmpty(pref?.irrigationAllowed),
  };
}

function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const TRAINING_RUN_INCLUDE = {
  project: { select: { primaryGoal: true } },
  environmentSnapshot: { include: { space: true } },
  space: true,
  userPreference: true,
  candidates: { include: { species: true } },
};

/**
 * Load runs from DB and produce full CSV text (header + one row per run with space).
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{ activeSpeciesOnly?: boolean }} [options]
 */
export async function buildTrainingExportCsvString(prisma, options = {}) {
  const activeSpeciesOnly = options.activeSpeciesOnly !== false;

  const catalog = await prisma.speciesCatalog.findMany({
    where: activeSpeciesOnly ? { active: true } : {},
    orderBy: { code: "asc" },
    select: { code: true },
  });
  const speciesCodes = catalog.map((s) => s.code);

  const runs = await prisma.recommendationRun.findMany({
    where: { spaceId: { not: null } },
    include: TRAINING_RUN_INCLUDE,
  });

  const targetKeys = speciesCodes.map((c) => `species_${c}`);
  const header = [...TRAINING_FEATURE_COLUMNS, ...targetKeys].join(",");
  const lines = [header];

  for (const run of runs) {
    const feats = buildTrainingFeatureRecord(run);
    const positive = collectPositiveSpeciesCodesFromAcceptInstall(run);
    const featureVals = TRAINING_FEATURE_COLUMNS.map((k) =>
      csvCell(feats[k]),
    );
    const targetVals = speciesCodes.map((code) =>
      positive.has(code) ? "1" : "0",
    );
    lines.push([...featureVals, ...targetVals].join(","));
  }

  return {
    csv: `${lines.join("\n")}\n`,
    rowCount: runs.length,
    speciesColumnCount: speciesCodes.length,
  };
}
