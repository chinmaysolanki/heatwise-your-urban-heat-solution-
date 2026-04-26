/**
 * Quality checks for SpeciesCatalog traits that drive catalogHybridFallback fallbacks.
 * Pure functions: safe for CI without DB when validating seed-shaped snapshots.
 */

export type SpeciesTraitQualityRow = {
  code: string;
  droughtTolerance: string | null;
  droughtTolerant: boolean;
  minSunHours: number | null;
  maxSunHours: number | null;
  petSafe: boolean;
  edible: boolean;
  category: string | null;
  sunExposure: string | null;
};

export type SpeciesTraitQualityIssue = {
  code: string;
  level: "error" | "warn";
  message: string;
};

/** Vocabulary for `SpeciesCatalog.droughtTolerance`: plant's *drought tolerance* (not water demand). HIGH = very tolerant. */
export const DROUGHT_TOLERANCE_LEVELS = new Set(["HIGH", "MEDIUM", "MED", "LOW"]);

const SUN_HOUR_MIN = 0;
const SUN_HOUR_MAX = 18;

function normDroughtTol(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

function push(
  out: SpeciesTraitQualityIssue[],
  code: string,
  level: "error" | "warn",
  message: string,
): void {
  out.push({ code, level, message });
}

/**
 * Validate one catalog row. Errors fail CI; warns are for review.
 */
export function validateSpeciesTraitRow(row: SpeciesTraitQualityRow): SpeciesTraitQualityIssue[] {
  const issues: SpeciesTraitQualityIssue[] = [];
  const code = row.code || "(missing code)";

  const dTol = row.droughtTolerance == null || row.droughtTolerance === "" ? null : normDroughtTol(row.droughtTolerance);
  if (dTol != null && !DROUGHT_TOLERANCE_LEVELS.has(dTol)) {
    push(
      issues,
      code,
      "error",
      `droughtTolerance "${row.droughtTolerance}" is not in allowed set (${[...DROUGHT_TOLERANCE_LEVELS].join(", ")}).`,
    );
  }

  if (dTol === "HIGH" && row.droughtTolerant === false) {
    push(
      issues,
      code,
      "error",
      "droughtTolerance HIGH (high plant drought tolerance) contradicts droughtTolerant=false; hybrid maps this to low irrigation demand.",
    );
  }
  if (dTol === "LOW" && row.droughtTolerant === true) {
    push(
      issues,
      code,
      "error",
      "droughtTolerance LOW contradicts droughtTolerant=true.",
    );
  }

  const mn = row.minSunHours;
  const mx = row.maxSunHours;
  if (mn != null) {
    if (!Number.isFinite(mn) || mn < SUN_HOUR_MIN || mn > SUN_HOUR_MAX) {
      push(issues, code, "error", `minSunHours ${mn} out of range [${SUN_HOUR_MIN}, ${SUN_HOUR_MAX}].`);
    }
  }
  if (mx != null) {
    if (!Number.isFinite(mx) || mx < SUN_HOUR_MIN || mx > SUN_HOUR_MAX) {
      push(issues, code, "error", `maxSunHours ${mx} out of range [${SUN_HOUR_MIN}, ${SUN_HOUR_MAX}].`);
    }
  }
  if (mn != null && mx != null && mn > mx) {
    push(issues, code, "error", `minSunHours (${mn}) > maxSunHours (${mx}).`);
  }

  const sun = (row.sunExposure ?? "").trim().toUpperCase();
  if (sun && !["FULL", "PARTIAL", "PART", "SHADE"].includes(sun)) {
    push(issues, code, "warn", `sunExposure "${row.sunExposure}" is non-standard; expected FULL, PARTIAL/PART, or SHADE.`);
  }
  if (mx != null && mx <= 4 && (sun === "FULL" || sun === "")) {
    push(
      issues,
      code,
      "warn",
      `maxSunHours=${mx} suggests limited sun but sunExposure is ${row.sunExposure ?? "unset"}; verify fallback sun bucket.`,
    );
  }

  const cat = (row.category ?? "").toUpperCase();
  if (cat === "HERB" && !row.edible) {
    push(issues, code, "error", "category HERB with edible=false is unexpected for catalog-hybrid edible routing.");
  }
  if (cat === "VEGETABLE" && !row.edible) {
    push(issues, code, "warn", "category VEGETABLE with edible=false — confirm intentional (e.g. ornamental cultivar).");
  }

  /**
   * Pet: DB stores a single boolean; runtime merges CSV tri-state (stricter wins).
   * Flag obvious tension for review only.
   */
  if (row.petSafe && !row.edible && (cat === "ORNAMENTAL" || cat === "SUCCULENT")) {
    push(
      issues,
      code,
      "warn",
      "petSafe=true with non-edible ORNAMENTAL/SUCCULENT — verify against species tox data (CSV may tighten).",
    );
  }

  return issues;
}

export function validateSpeciesTraitRows(rows: SpeciesTraitQualityRow[]): SpeciesTraitQualityIssue[] {
  const all: SpeciesTraitQualityIssue[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.code)) {
      all.push({ code: row.code, level: "error", message: "duplicate code in validation batch" });
    }
    seen.add(row.code);
    all.push(...validateSpeciesTraitRow(row));
  }
  return all;
}

export function partitionTraitIssues(issues: SpeciesTraitQualityIssue[]): { errors: SpeciesTraitQualityIssue[]; warns: SpeciesTraitQualityIssue[] } {
  return {
    errors: issues.filter((i) => i.level === "error"),
    warns: issues.filter((i) => i.level === "warn"),
  };
}
