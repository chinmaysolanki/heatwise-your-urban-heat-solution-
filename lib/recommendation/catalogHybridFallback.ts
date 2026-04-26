/**
 * When Python ``serving`` is unavailable: rank real catalog + species_features rows
 * with hard safety filters, bootstrap trait proxies (mirroring ML head roles), and
 * the same blend weights as production ``blend_scores``.
 */

import fs from "fs";
import path from "path";

import type {
  BlendWeightsInput,
  RecommendationGenerateRequest,
  RecommendationGenerateResponse,
  RuntimeCandidate,
} from "@/lib/ml/recommendationRuntimeTypes";
import { db } from "@/lib/db";
import { applySupplyConstraintsToRuntimeCandidates } from "@/lib/services/recommendationConstraintService";
import { buildRulesOnlyFallback } from "@/lib/recommendation/rulesOnlyFallback";
import { SPECIES_CATALOG_MAPPING_V1 } from "@/lib/species/speciesCatalogMapping";

const RULES_VERSION = "hw-rules-v1.2-catalog-hybrid-ts";
const DEMO_SPECIES_CSV = "ml/data/bootstrap/sample_outputs/demo_pack/species_features.csv";

/** Legacy ``species_key`` in species_features CSV → ``SpeciesCatalog.code`` (from generated mapping artifact). */
const SPECIES_FEATURES_KEY_ALIASES: Readonly<Record<string, string>> =
  SPECIES_CATALOG_MAPPING_V1.speciesFeatureKeyAliases ?? {};

/** Raw CSV keys skipped for hybrid merge (training-only rows / taxonomy quarantine). */
const SPECIES_FEATURES_KEYS_EXCLUDE_HYBRID: ReadonlySet<string> = new Set(
  SPECIES_CATALOG_MAPPING_V1.speciesFeatureKeysExcludeFromCatalogHybrid ?? [],
);

function canonicalSpeciesFeatureKey(raw: string): string {
  const k = raw.trim();
  return SPECIES_FEATURES_KEY_ALIASES[k] ?? k;
}

function resolveOptionalPath(raw: string | undefined, baseDir: string): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const s = raw.trim();
  return path.isAbsolute(s) ? path.normalize(s) : path.resolve(baseDir, s);
}

function resolveSpeciesCsvPath(req: RecommendationGenerateRequest): string | null {
  const appRoot = process.cwd();
  const fromReq = resolveOptionalPath(req.speciesCsvPath ?? process.env.HEATWISE_SPECIES_CSV, appRoot);
  if (fromReq && fs.existsSync(fromReq)) return fromReq;
  const demo = path.join(appRoot, DEMO_SPECIES_CSV);
  if (fs.existsSync(demo)) return demo;
  return null;
}

/**
 * Same CSV resolution as catalog hybrid (env HEATWISE_SPECIES_CSV → demo pack).
 * Pass `null` to force DB-only merge for audits.
 */
export function resolveCatalogHybridSpeciesCsvPath(opts?: { overridePath?: string | null }): string | null {
  const appRoot = process.cwd();
  if (opts?.overridePath === null) return null;
  if (opts?.overridePath != null && opts.overridePath.trim() !== "") {
    const p = path.isAbsolute(opts.overridePath)
      ? path.normalize(opts.overridePath)
      : path.resolve(appRoot, opts.overridePath.trim());
    return fs.existsSync(p) ? p : null;
  }
  const fromEnv = resolveOptionalPath(process.env.HEATWISE_SPECIES_CSV, appRoot);
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const demo = path.join(appRoot, DEMO_SPECIES_CSV);
  if (fs.existsSync(demo)) return demo;
  return null;
}

export type TraitRow = {
  code: string;
  displayName: string;
  childPetSafety: "SAFE" | "CAUTION" | "UNSAFE" | null;
  climateTokens: string[];
  sunlightPreference: string | null;
  waterDemand: string | null;
  maintenanceNeed: string | null;
  containerSuitability: string | null;
  coolingContribution: number;
  edible: boolean;
  pollinatorValue: number;
  nativeSupport: string | null;
  dbPetSafe: boolean | null;
  dbHeatTolerant: boolean | null;
  dbDroughtTolerant: boolean | null;
  /** Legacy DB string: drought *tolerance* HIGH ⇒ low irrigation demand for rules. */
  dbDroughtToleranceStr: string | null;
  dbLowMaintenance: boolean | null;
  dbEdible: boolean | null;
  mlWeight: number | null;
  /** From SpeciesCatalog: typical minimum direct sun hours for good performance in pots. */
  minSunHours: number | null;
  /** From SpeciesCatalog: flowering ornamentals get mild demotion under xeric / cooling-first heuristics. */
  dbFlowering: boolean | null;
};

/**
 * Active SpeciesCatalog rows merged with optional species_features CSV (same pipeline as catalog hybrid).
 * `rows` are **catalog-active only** (excludes CSV-only keys not in the DB catalog). Use `extraCsvOnlyRowCount`
 * to see how many CSV-only species were merged in then dropped from this slice.
 */
export async function loadMergedCatalogHybridTraitRows(opts?: {
  speciesCsvPath?: string | null;
}): Promise<{
  rows: TraitRow[];
  csvPath: string | null;
  extraCsvOnlyRowCount: number;
}> {
  const csvPath =
    opts?.speciesCsvPath === null ? null : resolveCatalogHybridSpeciesCsvPath({ overridePath: opts?.speciesCsvPath });
  const map = await loadCatalogTraits();
  const catalogCodes = new Set(map.keys());
  const merged = mergeCsvIntoTraits(csvPath, map);
  let extraCsvOnlyRowCount = 0;
  const rows: TraitRow[] = [];
  for (const r of merged) {
    if (catalogCodes.has(r.code)) rows.push(r);
    else extraCsvOnlyRowCount += 1;
  }
  return { rows, csvPath, extraCsvOnlyRowCount };
}

function parseCsvRecords(filePath: string): Record<string, string>[] {
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(",");
    const rec: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      rec[header[j]!] = (cells[j] ?? "").trim();
    }
    rows.push(rec);
  }
  return rows;
}

function normUpper(s: string | null | undefined): string {
  return (s ?? "").trim().toUpperCase();
}

/** Stricter pet labels win (UNSAFE > CAUTION > SAFE); CSV and DB can both contribute. */
function petSafetyStrictness(s: TraitRow["childPetSafety"]): number {
  if (s === "UNSAFE") return 3;
  if (s === "CAUTION") return 2;
  if (s === "SAFE") return 1;
  return 0;
}

export function reconcileChildPetSafety(
  csvLevel: TraitRow["childPetSafety"],
  dbPetSafe: boolean | null,
): TraitRow["childPetSafety"] {
  const fromDb: TraitRow["childPetSafety"] =
    dbPetSafe === true ? "SAFE" : dbPetSafe === false ? "UNSAFE" : null;
  let best: TraitRow["childPetSafety"] = null;
  let bestR = 0;
  for (const x of [csvLevel, fromDb]) {
    if (x == null) continue;
    const r = petSafetyStrictness(x);
    if (r > bestR) {
      bestR = r;
      best = x;
    }
  }
  return best;
}

/**
 * Effective irrigation demand bucket for gates/scoring: CSV/merged water_demand wins, else DB drought flags.
 * Empty string = still unknown after DB inference (handled conservatively at call sites).
 */
export function effectiveWaterDemandNorm(species: Pick<TraitRow, "waterDemand" | "dbDroughtTolerant" | "dbDroughtToleranceStr">): string {
  const raw = normUpper(species.waterDemand);
  if (raw === "HIGH" || raw === "MED" || raw === "MEDIUM" || raw === "LOW") return raw;
  if (species.dbDroughtTolerant === true) return "LOW";
  const tol = normUpper(species.dbDroughtToleranceStr ?? "");
  if (tol === "HIGH") return "LOW";
  if (tol === "MED" || tol === "MEDIUM") return "MED";
  if (tol === "LOW") return "HIGH";
  return "";
}

/** Effective sun preference for rules when CSV/DB text missing: derive from minSunHours. */
export function effectiveSunlightPrefNorm(species: Pick<TraitRow, "sunlightPreference" | "minSunHours">): string {
  const p = normUpper(species.sunlightPreference);
  if (p === "FULL" || p === "PART" || p === "SHADE") return p;
  const h = species.minSunHours;
  if (h != null) {
    if (h >= 7) return "FULL";
    if (h <= 3) return "SHADE";
    return "PART";
  }
  return "";
}

/**
 * Fill missing CSV traits from SpeciesCatalog fields (does not overwrite non-empty CSV).
 */
export function applyMergedTraitFallbacks(row: TraitRow): void {
  if (!row.waterDemand?.trim()) {
    if (row.dbDroughtTolerant === true) {
      row.waterDemand = "LOW";
    } else {
      const tol = normUpper(row.dbDroughtToleranceStr ?? "");
      if (tol === "HIGH") row.waterDemand = "LOW";
      else if (tol === "MED" || tol === "MEDIUM") row.waterDemand = "MED";
      else if (tol === "LOW") row.waterDemand = "HIGH";
    }
  }
  if (!row.sunlightPreference?.trim()) {
    const h = row.minSunHours;
    if (h != null) {
      if (h >= 7) row.sunlightPreference = "FULL";
      else if (h <= 3) row.sunlightPreference = "SHADE";
      else row.sunlightPreference = "PART";
    }
  }
}

function petSafetyFromCsv(raw: string | null | undefined): TraitRow["childPetSafety"] {
  const u = normUpper(raw);
  if (u === "SAFE" || u === "CAUTION" || u === "UNSAFE") return u;
  return null;
}

function coolingFromCsv(raw: string | null | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 1;
}

async function loadCatalogTraits(): Promise<Map<string, TraitRow>> {
  const rows = await db.speciesCatalog.findMany({
    where: { active: true },
    select: {
      code: true,
      displayName: true,
      petSafe: true,
      heatTolerant: true,
      droughtTolerant: true,
      lowMaintenance: true,
      edible: true,
      mlWeight: true,
      minSunHours: true,
      sunExposure: true,
      flowering: true,
      droughtTolerance: true,
    },
  });
  const map = new Map<string, TraitRow>();
  for (const r of rows) {
    const se = r.sunExposure?.trim();
    const prefFromDb =
      se && /^full/i.test(se) ? "FULL" : se && /shade/i.test(se) ? "SHADE" : se && /part/i.test(se) ? "PART" : null;
    map.set(r.code, {
      code: r.code,
      displayName: r.displayName,
      childPetSafety: r.petSafe ? "SAFE" : "UNSAFE",
      climateTokens: [],
      sunlightPreference: prefFromDb,
      waterDemand: null,
      maintenanceNeed: null,
      containerSuitability: null,
      coolingContribution: r.heatTolerant ? 2.2 : 1.0,
      edible: r.edible,
      pollinatorValue: 2,
      nativeSupport: null,
      dbPetSafe: r.petSafe,
      dbHeatTolerant: r.heatTolerant,
      dbDroughtTolerant: r.droughtTolerant,
      dbDroughtToleranceStr: r.droughtTolerance?.trim() ?? null,
      dbLowMaintenance: r.lowMaintenance,
      dbEdible: r.edible,
      mlWeight: r.mlWeight,
      minSunHours: r.minSunHours ?? null,
      dbFlowering: r.flowering,
    });
  }
  return map;
}

function finalizeTraitRows(rows: TraitRow[]): TraitRow[] {
  for (const row of rows) {
    applyMergedTraitFallbacks(row);
  }
  return rows;
}

function mergeCsvIntoTraits(csvPath: string | null, base: Map<string, TraitRow>): TraitRow[] {
  if (!csvPath) {
    return finalizeTraitRows([...base.values()]);
  }
  let csvRows: Record<string, string>[];
  try {
    csvRows = parseCsvRecords(csvPath);
  } catch {
    return finalizeTraitRows([...base.values()]);
  }

  for (const rec of csvRows) {
    const rawSpeciesKey = (rec.species_key ?? "").trim();
    if (!rawSpeciesKey) continue;
    if (SPECIES_FEATURES_KEYS_EXCLUDE_HYBRID.has(rawSpeciesKey)) continue;

    const code = canonicalSpeciesFeatureKey(rawSpeciesKey);
    if (!code) continue;
    const existing = base.get(code);
    const displayName = rec.species_name?.trim() || existing?.displayName || code;
    const merged: TraitRow = existing ?? {
      code,
      displayName,
      childPetSafety: reconcileChildPetSafety(petSafetyFromCsv(rec.child_pet_safety), null),
      climateTokens: (rec.climate_suitability ?? "")
        .split("|")
        .map((t) => t.trim())
        .filter(Boolean),
      sunlightPreference: rec.sunlight_preference?.trim() ?? null,
      waterDemand: rec.water_demand?.trim() ?? null,
      maintenanceNeed: rec.maintenance_need?.trim() ?? null,
      containerSuitability: rec.container_suitability?.trim() ?? null,
      coolingContribution: coolingFromCsv(rec.cooling_contribution),
      edible: (rec.edible ?? "").trim() === "1",
      pollinatorValue: Number(rec.pollinator_value) || 0,
      nativeSupport: rec.native_support?.trim() ?? null,
      dbPetSafe: null,
      dbHeatTolerant: null,
      dbDroughtTolerant: null,
      dbDroughtToleranceStr: null,
      dbLowMaintenance: null,
      dbEdible: null,
      mlWeight: null,
      minSunHours: null,
      dbFlowering: null,
    };

    if (existing) {
      merged.minSunHours = existing.minSunHours;
      merged.dbFlowering = existing.dbFlowering;
      merged.dbDroughtToleranceStr = existing.dbDroughtToleranceStr;
      merged.displayName = rec.species_name?.trim() || existing.displayName;
      const ps = petSafetyFromCsv(rec.child_pet_safety);
      merged.childPetSafety = reconcileChildPetSafety(ps, merged.dbPetSafe ?? null);
      merged.climateTokens = (rec.climate_suitability ?? "")
        .split("|")
        .map((t) => t.trim())
        .filter(Boolean);
      if (rec.sunlight_preference?.trim()) merged.sunlightPreference = rec.sunlight_preference.trim();
      if (rec.water_demand?.trim()) merged.waterDemand = rec.water_demand.trim();
      if (rec.maintenance_need?.trim()) merged.maintenanceNeed = rec.maintenance_need.trim();
      if (rec.container_suitability?.trim()) merged.containerSuitability = rec.container_suitability.trim();
      const cc = coolingFromCsv(rec.cooling_contribution);
      if (cc > 0) merged.coolingContribution = cc;
      if ((rec.edible ?? "").trim() === "1") merged.edible = true;
      const pv = Number(rec.pollinator_value);
      if (Number.isFinite(pv)) merged.pollinatorValue = pv;
      if (rec.native_support?.trim()) merged.nativeSupport = rec.native_support.trim();
    }

    base.set(code, merged);
  }

  return finalizeTraitRows([...base.values()]);
}

function envSunBucket(environment: Record<string, unknown>): "FULL" | "PART" | "SHADE" {
  const sl = environment.sunExposure ?? environment.shade_level;
  const s = String(sl ?? "partial").toLowerCase();
  if (s.includes("full") || s === "light") return "FULL";
  if (s.includes("shade") || s.includes("heavy")) return "SHADE";
  const hours = Number(environment.sunlight_hours ?? 5);
  if (hours >= 7) return "FULL";
  if (hours <= 3.5) return "SHADE";
  return "PART";
}

function sunMatch(pref: string | null, bucket: "FULL" | "PART" | "SHADE"): number {
  const p = normUpper(pref);
  if (!p) return 0.75;
  if (p === "FULL" && bucket === "FULL") return 1;
  if (p === "PART" && bucket === "PART") return 1;
  if (p === "SHADE" && bucket === "SHADE") return 1;
  if (p === "PART" && (bucket === "FULL" || bucket === "SHADE")) return 0.82;
  if (p === "FULL" && bucket === "PART") return 0.78;
  if (p === "SHADE" && bucket === "FULL") return 0.55;
  return 0.65;
}

function siteSunHoursForRules(environment: Record<string, unknown>): number {
  const h = Number(environment.sunlight_hours);
  if (Number.isFinite(h) && h >= 0) return h;
  const b = envSunBucket(environment);
  if (b === "SHADE") return 2.5;
  if (b === "FULL") return 8;
  return 5;
}

function isShadeHeavySite(environment: Record<string, unknown>): boolean {
  if (envSunBucket(environment) === "SHADE") return true;
  const h = Number(environment.sunlight_hours);
  return Number.isFinite(h) && h <= 3.5;
}

/** Strong full-sun species are excluded for heavy-shade / very low sun-hour sites. */
function shadeSunMismatchHardExclude(species: TraitRow, environment: Record<string, unknown>): boolean {
  if (!isShadeHeavySite(environment)) return false;
  const siteH = siteSunHoursForRules(environment);
  const pref = effectiveSunlightPrefNorm(species);
  if (pref === "FULL") return true;
  if (species.minSunHours != null && species.minSunHours > siteH + 0.75) return true;
  /** Heavy shade + very thirsty species skew to the wrong microclimate; keep shade-tolerant lower-irrigation options. */
  if (effectiveWaterDemandNorm(species) === "HIGH") return true;
  return false;
}

/** High irrigation-demand species are excluded when water is scarce (CSV water_demand + DB drought flag). */
function waterScarcityHardExclude(species: TraitRow, environment: Record<string, unknown>): boolean {
  const w = String(environment.water_availability ?? environment.waterAvailability ?? "").toLowerCase();
  if (w !== "scarce") return false;
  const demand = effectiveWaterDemandNorm(species);
  if (demand === "HIGH") return true;
  if (demand === "MED" || demand === "MEDIUM") {
    if (species.dbDroughtTolerant !== true) return true;
  }
  /** Unknown demand under scarce water: exclude unless catalog marks drought-tolerant. */
  if (demand === "" && species.dbDroughtTolerant !== true) return true;
  return false;
}

function envWaterScarce(environment: Record<string, unknown>): boolean {
  return String(environment.water_availability ?? environment.waterAvailability ?? "").toLowerCase() === "scarce";
}

function isOrnamentalOnly(species: TraitRow): boolean {
  const isEdiblePlant = !!(species.edible || species.dbEdible);
  return !isEdiblePlant && (species.dbEdible === false || (species.dbEdible == null && !species.edible));
}

/**
 * Showy full-sun flowering ornamentals (high pollinator + strong cooling score): still drought-tolerant
 * but less “scarce-water structural” than groundcover / succulent / screen plants.
 */
function showyFullSunOrnamental(species: TraitRow): boolean {
  if (!isOrnamentalOnly(species)) return false;
  if (species.dbFlowering !== true) return false;
  if (effectiveSunlightPrefNorm(species) !== "FULL") return false;
  return (species.pollinatorValue ?? 0) >= 3 && species.coolingContribution >= 2.8;
}

/** Boost strict xeric fits; mildly demote showy flowering ornamentals under scarce water. */
function scarceWaterPriorityFactor(species: TraitRow): number {
  const demand = effectiveWaterDemandNorm(species);
  const strictLow = demand === "LOW";
  const dt = species.dbDroughtTolerant === true;
  const medDrought = (demand === "MED" || demand === "MEDIUM") && dt;

  let factor = 1;
  if (strictLow && dt) factor = 1.30;
  else if (strictLow) factor = 1.12;
  else if (medDrought) factor = 0.90;

  if (showyFullSunOrnamental(species)) {
    factor *= 0.58;
  }

  /** Med-water + showy bloom: tolerates drought in catalog but still less “xeric intent” than LOW-water structural plants. */
  const medShowyOrnamental =
    isOrnamentalOnly(species) &&
    species.dbFlowering === true &&
    effectiveSunlightPrefNorm(species) === "FULL" &&
    (species.pollinatorValue ?? 0) >= 3 &&
    (demand === "MED" || demand === "MEDIUM") &&
    dt;
  if (medShowyOrnamental) {
    factor *= 0.71;
  }

  return factor;
}

/**
 * Pet-safe context only: mildly demote large-format / high-maintenance species that
 * passed the safety gate but are a poor fit for companion pet gardens.
 * Mildly prefers compact, low-maintenance, edible companion plants.
 * Applied to the ranking sub-score only; returns 1.0 when pet-safe is not required.
 */
function petSafeRankingNudge(
  species: TraitRow,
  preferences: Record<string, unknown>,
): number {
  const petRequired = Number(preferences.child_pet_safe_required ?? preferences.petSafeRequired ?? 0);
  if (!petRequired) return 1.0;

  const mTier = maintenanceTier(species.maintenanceNeed);
  const cScore = containerScore(species.containerSuitability);
  const isEdible = !!(species.edible || species.dbEdible);

  // Large-format species with poor container suitability: pot-hostile screening plants.
  if (mTier >= 2 && cScore <= 0.72) return 0.80;
  // High-maintenance non-edibles (ornamental screens, utility plants) that passed safety.
  if (mTier >= 2 && !isEdible) return 0.88;

  // Compact, low-maintenance edible plants: ideal companion-garden fit.
  if (mTier === 0 && isEdible) return 1.08;

  return 1.0;
}

function scoreClamp01(x: number): number {
  return Math.max(0.06, Math.min(1, x));
}

function containerScore(raw: string | null): number {
  const u = normUpper(raw);
  if (u === "EXCELLENT") return 0.95;
  if (u === "GOOD") return 0.86;
  if (u === "MED" || u === "MEDIUM" || u === "FAIR") return 0.72;
  if (u === "POOR") return 0.55;
  return 0.82;
}

function maintenanceTier(m: string | null): number {
  const u = normUpper(m);
  if (u === "MINIMAL" || u === "LOW") return 0;
  if (u === "MED" || u === "MEDIUM") return 1;
  return 2;
}

function userMaintenanceTier(prefs: Record<string, unknown>): number {
  const raw = String(prefs.maintenanceLevel ?? prefs.maintenance_level ?? "medium").toLowerCase();
  if (raw.includes("low") || raw.includes("minimal")) return 0;
  if (raw.includes("high")) return 2;
  return 1;
}

/** Treat scarce water like no hose access for stress scoring. */
function envHasReliableWater(environment: Record<string, unknown>): boolean {
  const scarce =
    String(environment.water_availability ?? environment.waterAvailability ?? "").toLowerCase() === "scarce";
  if (scarce) return false;
  return Boolean(environment.water_access ?? environment.waterAccess);
}

function waterStress(species: TraitRow, waterAccess: boolean): number {
  const w = effectiveWaterDemandNorm(species);
  if (waterAccess) return 1.0;
  if (w === "HIGH") return 0.45;
  if (w === "MED" || w === "MEDIUM") return 0.72;
  return 0.92;
}

function normalizeBlendWeights(raw: BlendWeightsInput | undefined): {
  rules: number;
  feasibilityMl: number;
  heatMl: number;
  rankingMl: number;
} {
  const rules = Number(raw?.rules ?? 0.25);
  const feasibilityMl = Number(raw?.feasibilityMl ?? 0.25);
  const heatMl = Number(raw?.heatMl ?? 0.25);
  const rankingMl = Number(raw?.rankingMl ?? 0.25);
  const s = rules + feasibilityMl + heatMl + rankingMl;
  if (s <= 0) return { rules: 1, feasibilityMl: 0, heatMl: 0, rankingMl: 0 };
  return {
    rules: rules / s,
    feasibilityMl: feasibilityMl / s,
    heatMl: heatMl / s,
    rankingMl: rankingMl / s,
  };
}

function blendScores(
  ruleScore: number,
  feasibility: number | null,
  heat: number | null,
  ranking: number | null,
  weights: BlendWeightsInput | undefined,
): { blended: number; parts: Record<string, number> } {
  const w = normalizeBlendWeights(weights);
  const f = feasibility ?? ruleScore;
  const h = heat ?? ruleScore;
  const r = Math.max(0, Math.min(1, ranking ?? ruleScore));
  const parts: Record<string, number> = {
    rules: w.rules * ruleScore,
    feasibility_ml: w.feasibilityMl * f,
    heat_ml: w.heatMl * h,
    ranking_ml: w.rankingMl * r,
  };
  const blended = parts.rules! + parts.feasibility_ml! + parts.heat_ml! + parts.ranking_ml!;
  return { blended, parts };
}

// ── Live environment signal helpers ──────────────────────────────────────────

type HeatExposureLevel = "low" | "medium" | "high" | "extreme";
type WindExposureLevel = "sheltered" | "moderate" | "windy" | "severe";

function envHeatExposure(environment: Record<string, unknown>): HeatExposureLevel | null {
  const v = String(environment.heat_exposure ?? "").toLowerCase();
  if (v === "low" || v === "medium" || v === "high" || v === "extreme") return v as HeatExposureLevel;
  // Derive from daily_max_temp_c if heat_exposure not present
  const maxT = Number(environment.daily_max_temp_c ?? environment.summer_temp_c ?? environment.summerTempC ?? NaN);
  if (!Number.isFinite(maxT)) return null;
  if (maxT >= 38) return "extreme";
  if (maxT >= 33) return "high";
  if (maxT >= 28) return "medium";
  return "low";
}

function envWindExposure(environment: Record<string, unknown>): WindExposureLevel | null {
  const v = String(environment.wind_exposure ?? "").toLowerCase();
  if (v === "sheltered" || v === "moderate" || v === "windy" || v === "severe") return v as WindExposureLevel;
  // Derive from wind_speed_kmh if not present
  const kmh = Number(environment.wind_speed_kmh ?? NaN);
  if (!Number.isFinite(kmh)) return null;
  if (kmh >= 50) return "severe";
  if (kmh >= 30) return "windy";
  if (kmh >= 15) return "moderate";
  return "sheltered";
}

function envSpaceType(project: Record<string, unknown>): string {
  return String(project.space_type ?? project.spaceType ?? project.surfaceType ?? "outdoor_rooftop").toLowerCase();
}

/**
 * Indoor spaces: exclude species that REQUIRE strong direct sun (≥6 h/day).
 * Full-sun succulents, large ornamental grasses, and heat-loving climbers rarely thrive indoors.
 */
function indoorFullSunHardExclude(species: TraitRow, spaceType: string): boolean {
  if (!spaceType.includes("indoor")) return false;
  const pref = effectiveSunlightPrefNorm(species);
  if (pref === "FULL") return true;
  if (species.minSunHours != null && species.minSunHours > 5) return true;
  return false;
}

/**
 * Extreme heat: exclude species with confirmed low heat tolerance.
 * `dbHeatTolerant === false` is the explicit catalog signal for heat-intolerant species.
 */
function extremeHeatHardExclude(species: TraitRow, heat: HeatExposureLevel | null): boolean {
  if (heat !== "extreme") return false;
  return species.dbHeatTolerant === false;
}

/**
 * Severe wind: exclude tall, fragile, or high-maintenance non-drought-tolerant species.
 * Climbers and large screening shrubs with high maintenance snap/topple in severe wind.
 */
function severeWindHardExclude(species: TraitRow, wind: WindExposureLevel | null): boolean {
  if (wind !== "severe") return false;
  const mTier = maintenanceTier(species.maintenanceNeed);
  const isDrought = species.dbDroughtTolerant === true;
  // High-maintenance + not drought-tolerant = fragile, resource-hungry → exclude in severe wind
  if (mTier >= 2 && !isDrought) return true;
  // Climbers (they snap off trellises in severe gusts)
  const climateStr = normUpper(species.climateTokens.join(" "));
  if (climateStr.includes("CLIMB")) return true;
  return false;
}

function speciesHardExcluded(
  species: TraitRow,
  project: Record<string, unknown>,
  environment: Record<string, unknown>,
  preferences: Record<string, unknown>,
): string[] {
  const reasons: string[] = [];
  if (shadeSunMismatchHardExclude(species, environment)) {
    reasons.push("HARD_SHADE_SUN_MISMATCH");
  }
  if (waterScarcityHardExclude(species, environment)) {
    reasons.push("HARD_WATER_SCARCE_HIGH_DEMAND");
  }
  const pet = Number(preferences.child_pet_safe_required ?? preferences.petSafeRequired ?? 0);
  if (pet) {
    if (species.childPetSafety === "UNSAFE") reasons.push("HARD_PET_UNSAFE_SPECIES");
    else if (species.childPetSafety === "CAUTION") reasons.push("HARD_PET_CAUTION_SPECIES");
    else if (species.childPetSafety == null && species.dbPetSafe === false) {
      reasons.push("HARD_PET_UNSAFE_SPECIES");
    }
  }
  const floor = Number(project.floor_level ?? project.floorLevel ?? 0);
  const load = String(project.load_capacity_level ?? project.loadCapacityLevel ?? "medium").toLowerCase();
  const habit = normUpper(species.maintenanceNeed);
  if (floor > 15 && load === "low" && habit === "HIGH") {
    reasons.push("HARD_HIGH_RISE_HEAVY_GREENING");
  }
  // Live environment signal filters
  const heat = envHeatExposure(environment);
  const wind = envWindExposure(environment);
  const spaceT = envSpaceType(project);
  if (indoorFullSunHardExclude(species, spaceT)) {
    reasons.push("HARD_INDOOR_FULL_SUN_SPECIES");
  }
  if (extremeHeatHardExclude(species, heat)) {
    reasons.push("HARD_EXTREME_HEAT_INTOLERANT");
  }
  if (severeWindHardExclude(species, wind)) {
    reasons.push("HARD_SEVERE_WIND_FRAGILE_SPECIES");
  }
  return reasons;
}

function evaluateCandidateHardConstraints(
  project: Record<string, unknown>,
  environment: Record<string, unknown>,
  preferences: Record<string, unknown>,
  candidate: Record<string, unknown>,
): string[] {
  const reasons: string[] = [];
  const load = String(project.load_capacity_level ?? project.loadCapacityLevel ?? "medium").toLowerCase();
  if (load === "low" && candidate.greenery_density === "high") {
    reasons.push("HARD_LOAD_HIGH_GREENERY");
  }
  const est = Number(candidate.estimated_install_cost_inr ?? 0);
  const budget = Number(project.budget_inr ?? preferences.budget_inr ?? 0);
  if (budget > 0 && est > budget * 1.25) {
    reasons.push("HARD_BUDGET_EXCEEDED");
  }
  const pet = Number(preferences.child_pet_safe_required ?? preferences.petSafeRequired ?? 0);
  if (pet) {
    const code = String(candidate.species_catalog_code ?? "").toLowerCase();
    const name = String(candidate.species_primary ?? "").toLowerCase();
    if (code === "bougainvillea" || name === "bougainvillea") {
      reasons.push("HARD_PET_UNSAFE_SPECIES");
    }
  }
  const irr = String(candidate.irrigation_type ?? "");
  const water = String(environment.water_availability ?? environment.waterAvailability ?? "");
  if (water === "scarce" && (irr === "sprinkler" || irr === "mist")) {
    reasons.push("HARD_WATER_SCARCE_SPRINKLER");
  }
  const floor = Number(project.floor_level ?? project.floorLevel ?? 0);
  if (floor > 15 && candidate.greenery_density === "high") {
    reasons.push("HARD_HIGH_RISE_HEAVY_GREENING");
  }
  return reasons;
}

type TemplateDef = {
  recommendation_type: string;
  greenery_density: string;
  planter_type: string;
  irrigation_type: string;
  shade_solution: string;
  cooling_strategy: string;
  maintenance_level_pred: string;
  species_mix_type: string;
  species_count_estimate: number;
  estimated_install_cost_inr: number;
  estimated_annual_maintenance_inr: number;
  expected_temp_reduction_c: number;
  expected_surface_temp_reduction_c: number;
  rule_template_score: number;
};

function templateForIndex(i: number, budget: number, species: TraitRow): TemplateDef {
  const coolingBoost = Math.min(0.8, species.coolingContribution * 0.22);
  const bases: TemplateDef[] = [
    {
      recommendation_type: "planter",
      greenery_density: "medium",
      planter_type: "raised",
      irrigation_type: "drip",
      shade_solution: "pergola",
      cooling_strategy: "evapotranspiration",
      maintenance_level_pred: "low",
      species_mix_type: "duo",
      species_count_estimate: 2,
      estimated_install_cost_inr: Math.min(52_000, budget * 1.08),
      estimated_annual_maintenance_inr: 6200,
      expected_temp_reduction_c: 1.6 + coolingBoost,
      expected_surface_temp_reduction_c: 3.4 + coolingBoost,
      rule_template_score: 0.72,
    },
    {
      recommendation_type: "shade_first",
      greenery_density: "low",
      planter_type: "container",
      irrigation_type: "manual",
      shade_solution: "shade_sail",
      cooling_strategy: "shading",
      maintenance_level_pred: "minimal",
      species_mix_type: "mono",
      species_count_estimate: 1,
      estimated_install_cost_inr: Math.min(34_000, budget * 0.95),
      estimated_annual_maintenance_inr: 4200,
      expected_temp_reduction_c: 1.1 + coolingBoost * 0.7,
      expected_surface_temp_reduction_c: 2.8 + coolingBoost,
      rule_template_score: 0.66,
    },
    {
      recommendation_type: "planter",
      greenery_density: "high",
      planter_type: "raised",
      irrigation_type: "drip",
      shade_solution: "green_wall_segment",
      cooling_strategy: "evapotranspiration",
      maintenance_level_pred: "medium",
      species_mix_type: "polyculture_lite",
      species_count_estimate: 4,
      estimated_install_cost_inr: Math.min(68_000, budget * 1.12),
      estimated_annual_maintenance_inr: 8800,
      expected_temp_reduction_c: 2.2 + coolingBoost,
      expected_surface_temp_reduction_c: 4.8 + coolingBoost,
      rule_template_score: 0.76,
    },
  ];
  return bases[i % bases.length]!;
}

function heuristicRankScore(
  species: TraitRow,
  project: Record<string, unknown>,
  environment: Record<string, unknown>,
  preferences: Record<string, unknown>,
): { rulePrior: number; feasibility: number; heat: number; ranking: number } {
  const sunBucket = envSunBucket(environment);
  const effSunPref = effectiveSunlightPrefNorm(species);
  const sunPrefMissing = !effSunPref;
  const sun = sunPrefMissing
    ? isShadeHeavySite(environment)
      ? 0.58
      : sunMatch(null, sunBucket)
    : sunMatch(effSunPref, sunBucket);
  const feas = containerScore(species.containerSuitability);
  const maintGap = 1.0 - Math.min(1, Math.abs(maintenanceTier(species.maintenanceNeed) - userMaintenanceTier(preferences)) * 0.22);
  const water = waterStress(species, envHasReliableWater(environment));
  const purpose = String(preferences.purpose_primary ?? "cooling").toLowerCase();
  const isFood =
    purpose.includes("food") || purpose.includes("edible") || purpose.includes("herb") || purpose.includes("kitchen");
  const isEdiblePlant = !!(species.edible || species.dbEdible);
  const ornamentalOnly = !isEdiblePlant && (species.dbEdible === false || (species.dbEdible == null && !species.edible));
  let edibleFit = 0.78;
  if (isFood) {
    if (isEdiblePlant) edibleFit = 1.0;
    else if (ornamentalOnly) edibleFit = 0.1;
    else edibleFit = 0.22;
  }
  const pollinator = Math.min(1, (species.pollinatorValue || 2) / 3.5);
  const native = normUpper(species.nativeSupport);
  const nativeFit = native === "HIGH" ? 1 : native === "MED" ? 0.88 : 0.75;
  const mwRaw = species.mlWeight;
  const mw = mwRaw != null && Number.isFinite(mwRaw) ? Math.max(0.35, Math.min(1.2, 0.85 + mwRaw * 0.05)) : 1;

  const edibleWeight = isFood ? 0.14 : 0.08;
  const rulePrior = Math.max(
    0.08,
    Math.min(
      1,
      0.28 + sun * 0.28 + maintGap * 0.18 + water * 0.18 + edibleFit * edibleWeight,
    ),
  );
  const heatCore = Math.min(1, species.coolingContribution / 3.2 + (species.dbHeatTolerant ? 0.12 : 0));
  const heat = Math.max(0.05, Math.min(1, heatCore * 0.92 + sun * 0.08));
  const rankingEdibleW = isFood ? 0.5 : 0.35;
  let ranking = Math.max(
    0.05,
    Math.min(1, (pollinator * 0.2 + nativeFit * 0.16 + edibleFit * rankingEdibleW + sun * 0.17) * mw),
  );

  const feasibility = Math.max(0.05, Math.min(1, feas * maintGap * 0.92 + water * 0.08));

  let rulePriorOut = rulePrior;
  let heatOut = heat;
  let rankingOut = ranking;

  if (envWaterScarce(environment)) {
    const sf = scarceWaterPriorityFactor(species);
    rulePriorOut = scoreClamp01(rulePriorOut * sf);
    rankingOut = scoreClamp01(rankingOut * sf);
    heatOut = scoreClamp01(heatOut * Math.min(1.06, 0.93 + 0.11 * Math.min(sf, 1.2)));
  }

  rankingOut = scoreClamp01(rankingOut * petSafeRankingNudge(species, preferences));

  const region = String(environment.region ?? "").toLowerCase();
  const coolingGoal = purpose.includes("cooling") || purpose.includes("cool");
  const hotAridCooling = (region.includes("arid") || region.includes("hot_arid")) && coolingGoal;

  if (hotAridCooling) {
    const climates = normUpper(species.climateTokens.join(" "));
    const demandN = effectiveWaterDemandNorm(species);
    const strictLowWater = demandN === "LOW";
    const droughtOk = species.dbDroughtTolerant === true;
    const coolingStrong = species.coolingContribution >= 2;
    const aridHint = climates.includes("HOT_DRY") || climates.includes("ARID");
    const heatOk = species.dbHeatTolerant === true || aridHint;

    const fullAlign = strictLowWater && droughtOk && coolingStrong && heatOk;
    const partialAlign =
      !fullAlign && droughtOk && coolingStrong && heatOk && demandN !== "HIGH";
    const weak = !droughtOk || species.coolingContribution < 1.5;

    let factor = 1;
    if (fullAlign) factor = 1.34;
    else if (partialAlign) factor = 1.12;
    else if (weak) factor = 0.72;
    else factor = 0.88;

    if (showyFullSunOrnamental(species)) {
      factor *= 0.76;
    }

    const heatBoost = fullAlign ? 1.12 : partialAlign ? 1.06 : factor;
    return {
      rulePrior: scoreClamp01(rulePriorOut * factor),
      feasibility,
      heat: scoreClamp01(heatOut * heatBoost),
      ranking: scoreClamp01(rankingOut * factor),
    };
  }

  // ── Live environment signal scoring ────────────────────────────────────────
  const heatExp = envHeatExposure(environment);
  const windExp = envWindExposure(environment);
  const spaceT = envSpaceType(project);

  // Extreme / high heat: strongly prefer heat-tolerant + drought-tolerant species
  if (heatExp === "extreme" || heatExp === "high") {
    const isHeatTolerant = species.dbHeatTolerant === true;
    const isDrought = species.dbDroughtTolerant === true;
    const heatBonus = heatExp === "extreme" ? 1.28 : 1.12;
    const heatPenalty = heatExp === "extreme" ? 0.62 : 0.80;
    if (isHeatTolerant && isDrought) {
      rulePriorOut = scoreClamp01(rulePriorOut * heatBonus);
      heatOut = scoreClamp01(heatOut * heatBonus);
      rankingOut = scoreClamp01(rankingOut * (heatExp === "extreme" ? 1.18 : 1.08));
    } else if (!isHeatTolerant) {
      rulePriorOut = scoreClamp01(rulePriorOut * heatPenalty);
      heatOut = scoreClamp01(heatOut * heatPenalty);
    }
  }

  // Windy / severe wind: prefer low-growing, compact, drought-tolerant species
  if (windExp === "windy" || windExp === "severe") {
    const isLowMaint = species.dbLowMaintenance === true || maintenanceTier(species.maintenanceNeed) === 0;
    const isDrought = species.dbDroughtTolerant === true;
    const isCompact = containerScore(species.containerSuitability) >= 0.86;
    const windBonus = windExp === "severe" ? 1.22 : 1.08;
    const windPenalty = windExp === "severe" ? 0.70 : 0.84;
    if (isLowMaint && isDrought && isCompact) {
      rulePriorOut = scoreClamp01(rulePriorOut * windBonus);
      rankingOut = scoreClamp01(rankingOut * windBonus);
    } else if (!isLowMaint && !isDrought) {
      rulePriorOut = scoreClamp01(rulePriorOut * windPenalty);
      rankingOut = scoreClamp01(rankingOut * windPenalty);
    }
  }

  // Indoor space: prefer shade-tolerant, compact, low-sun species
  if (spaceT === "indoor") {
    const isShade = effectiveSunlightPrefNorm(species) === "SHADE" || (species.minSunHours != null && species.minSunHours <= 3);
    const isCompact = containerScore(species.containerSuitability) >= 0.86;
    if (isShade && isCompact) {
      rankingOut = scoreClamp01(rankingOut * 1.18);
      rulePriorOut = scoreClamp01(rulePriorOut * 1.1);
    }
  }

  return {
    rulePrior: rulePriorOut,
    feasibility,
    heat: heatOut,
    ranking: rankingOut,
  };
}

export type CatalogHybridFallbackOpts = {
  stderr?: string;
  pythonExitCode?: number | null;
  /** Short stable tag for telemetry (why Node invoked catalog hybrid). */
  fallbackReason?:
    | "python_spawn_error"
    | "python_nonzero_exit"
    | "python_stdout_empty"
    | "python_stdout_invalid_json"
    | "python_stdout_unusable_payload";
};

export async function buildCatalogHybridFallback(
  req: RecommendationGenerateRequest,
  opts?: CatalogHybridFallbackOpts,
): Promise<RecommendationGenerateResponse> {
  const project = req.project ?? {};
  const environment = req.environment ?? {};
  const preferences = req.preferences ?? {};
  const maxC = Math.max(1, Math.min(24, Number(req.maxCandidates ?? 8)));
  const budget = Number(project.budget_inr ?? preferences.budget_inr ?? 80_000);

  const csvPath = resolveSpeciesCsvPath(req);
  const catalogMap = await loadCatalogTraits();
  const speciesRows = mergeCsvIntoTraits(csvPath, catalogMap).filter((s) => {
    if (catalogMap.size === 0) return true;
    return catalogMap.has(s.code);
  });

  const stderrNote = opts?.stderr?.trim();
  const exitCode = opts?.pythonExitCode;
  const fallbackReason = opts?.fallbackReason;

  if (speciesRows.length === 0) {
    const emergency = buildRulesOnlyFallback(req);
    emergency.telemetryMeta.mlErrors = [
      ...(emergency.telemetryMeta.mlErrors ?? []),
      "catalog_hybrid_no_species_data_emergency_rules_only",
      ...(fallbackReason ? [`catalog_fallback_reason:${fallbackReason}`] : []),
      ...(stderrNote ? [stderrNote.slice(0, 500)] : []),
      ...(exitCode != null ? [`python_exit_${exitCode}`] : []),
    ];
    return emergency;
  }

  const scored: { species: TraitRow; rulePrior: number; feasibility: number; heat: number; ranking: number; blended: number }[] =
    [];
  for (const species of speciesRows) {
    const pre = speciesHardExcluded(species, project, environment, preferences);
    if (pre.length) continue;
    const h = heuristicRankScore(species, project, environment, preferences);
    const { blended } = blendScores(h.rulePrior, h.feasibility, h.heat, h.ranking, req.blendWeights);
    scored.push({ species, ...h, blended });
  }

  scored.sort((a, b) => b.blended - a.blended);
  const topSpecies = scored.slice(0, maxC);

  if (topSpecies.length === 0) {
    const emergency = buildRulesOnlyFallback(req);
    emergency.telemetryMeta.mlErrors = [
      ...(emergency.telemetryMeta.mlErrors ?? []),
      "catalog_hybrid_all_species_filtered_emergency_rules_only",
      ...(fallbackReason ? [`catalog_fallback_reason:${fallbackReason}`] : []),
      ...(stderrNote ? [stderrNote.slice(0, 500)] : []),
      ...(exitCode != null ? [`python_exit_${exitCode}`] : []),
    ];
    return emergency;
  }

  const candidates: RuntimeCandidate[] = [];
  let rank = 1;
  for (let i = 0; i < topSpecies.length; i++) {
    const { species, rulePrior, feasibility, heat, ranking } = topSpecies[i]!;
    const tmpl = templateForIndex(i, budget, species);
    tmpl.estimated_install_cost_inr = Math.min(tmpl.estimated_install_cost_inr, budget * 1.1);

    const rawPayload: Record<string, unknown> = {
      candidate_id: `cand_cat_${species.code}_${Math.random().toString(36).slice(2, 10)}`,
      recommendation_type: tmpl.recommendation_type,
      greenery_density: tmpl.greenery_density,
      planter_type: tmpl.planter_type,
      irrigation_type: tmpl.irrigation_type,
      shade_solution: tmpl.shade_solution,
      cooling_strategy: tmpl.cooling_strategy,
      maintenance_level_pred: tmpl.maintenance_level_pred,
      species_mix_type: tmpl.species_mix_type,
      species_count_estimate: tmpl.species_count_estimate,
      estimated_install_cost_inr: tmpl.estimated_install_cost_inr,
      estimated_annual_maintenance_inr: tmpl.estimated_annual_maintenance_inr,
      expected_temp_reduction_c: tmpl.expected_temp_reduction_c,
      expected_surface_temp_reduction_c: tmpl.expected_surface_temp_reduction_c,
      species_primary: species.displayName,
      species_secondary: species.displayName,
      species_tertiary: species.displayName,
      species_catalog_code: species.code,
    };

    const blockReasons = evaluateCandidateHardConstraints(project, environment, preferences, rawPayload);
    const blocked = blockReasons.length > 0;
    const { blended: blendedFinal, parts } = blendScores(
      tmpl.rule_template_score,
      feasibility,
      heat,
      ranking,
      req.blendWeights,
    );

    const displayBlended = blocked ? 0 : blendedFinal;

    candidates.push({
      candidateId: String(rawPayload.candidate_id),
      rank: rank++,
      blocked,
      blockReasons,
      scores: {
        rulePrior: tmpl.rule_template_score,
        feasibilityMl: feasibility,
        heatMl: heat,
        rankingMl: ranking,
        blended: displayBlended,
        blendParts: parts,
      },
      candidatePayload: rawPayload,
      explanation: {
        summaryBullets: blocked
          ? [`Blocked: ${blockReasons.join(", ")}`]
          : [
              `Catalog hybrid rank for ${species.displayName} (${species.code}).`,
              "Scores use species_features + SpeciesCatalog with blend weights matching serving.",
            ],
        componentScores: { ...parts, trait_rule_prior: rulePrior },
        finalBlendedScore: displayBlended,
        mlHeadsUsed: { feasibility: true, heat: true, ranking: true },
        blocked,
      },
    });
  }

  candidates.sort((a, b) => Number(b.scores.blended) - Number(a.scores.blended));
  candidates.forEach((c, i) => {
    c.rank = i + 1;
  });

  if (req.supplyConstraints) {
    applySupplyConstraintsToRuntimeCandidates(candidates, req.supplyConstraints);
  }

  const mlErrors = [
    "python_runtime_unavailable_catalog_hybrid",
    ...(fallbackReason ? [`catalog_fallback_reason:${fallbackReason}`] : []),
    ...(csvPath ? [] : ["catalog_hybrid_missing_species_csv_using_db_traits"]),
    ...(stderrNote ? [stderrNote.slice(0, 500)] : []),
    ...(exitCode != null ? [`python_exit_${exitCode}`] : []),
  ];

  return {
    mode: "partial_ml",
    candidates,
    telemetryMeta: {
      generatorSource: "catalog_hybrid_ts",
      rulesVersion: req.rulesVersion ?? RULES_VERSION,
      modelVersionFeasibility: "bootstrap_traits_ts",
      modelVersionHeat: "bootstrap_traits_ts",
      modelVersionRanking: "bootstrap_traits_ts",
      mlErrors,
    },
    runExplanation: {
      mode: "partial_ml",
      note: "Catalog + CSV hybrid fallback in Node (hard filters + bootstrap trait scorers). Restore Python serving for sklearn bundles.",
    },
    errors: [],
  };
}
