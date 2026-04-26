/**
 * Merge-quality and trait coverage audit for catalogHybridFallback inputs.
 * Answers: how complete are merged rows for ranking, DB-only vs CSV-augmented, top gaps.
 */

import fs from "node:fs";

import { SPECIES_CATALOG_MAPPING_V1 } from "@/lib/species/speciesCatalogMapping";
import {
  effectiveSunlightPrefNorm,
  effectiveWaterDemandNorm,
  type TraitRow,
} from "@/lib/recommendation/catalogHybridFallback";

const SPECIES_FEATURES_KEY_ALIASES: Readonly<Record<string, string>> =
  SPECIES_CATALOG_MAPPING_V1.speciesFeatureKeyAliases ?? {};

function canonicalCsvCode(raw: string): string {
  const k = raw.trim();
  return SPECIES_FEATURES_KEY_ALIASES[k] ?? k;
}

export type CsvTraitPresence = {
  code: string;
  hasWaterDemand: boolean;
  hasSunlightPreference: boolean;
  /** CSV cell present and parses as a finite number (0–5 scale in pipeline; 0 still counts as explicit). */
  hasCoolingContribution: boolean;
  hasChildPetSafety: boolean;
  hasClimateTokens: boolean;
  hasContainerSuitability: boolean;
  hasMaintenanceNeed: boolean;
  hasPollinator: boolean;
  hasNativeSupport: boolean;
  /** ``edible`` column explicitly 0 or 1. */
  hasExplicitEdible: boolean;
  /** Parsed CSV cooling; merge applies only when > 0 (see catalogHybridFallback). */
  csvCoolingParsed: number | null;
};

function parseCsvForPresence(csvPath: string): Map<string, CsvTraitPresence> {
  const text = fs.readFileSync(csvPath, "utf8").trim();
  const map = new Map<string, CsvTraitPresence>();
  if (!text) return map;
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return map;
  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(",");
    const rec: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      rec[header[j]!] = (cells[j] ?? "").trim();
    }
    const code = canonicalCsvCode(rec.species_key ?? "");
    if (!code) continue;
    const coolRaw = (rec.cooling_contribution ?? "").trim();
    const coolN = Number(coolRaw);
    const edibleCell = (rec.edible ?? "").trim();
    map.set(code, {
      code,
      hasWaterDemand: Boolean(rec.water_demand?.trim()),
      hasSunlightPreference: Boolean(rec.sunlight_preference?.trim()),
      hasCoolingContribution: coolRaw !== "" && Number.isFinite(coolN),
      csvCoolingParsed: coolRaw !== "" && Number.isFinite(coolN) ? coolN : null,
      hasChildPetSafety: Boolean(rec.child_pet_safety?.trim()),
      hasClimateTokens: Boolean((rec.climate_suitability ?? "").trim()),
      hasContainerSuitability: Boolean(rec.container_suitability?.trim()),
      hasMaintenanceNeed: Boolean(rec.maintenance_need?.trim()),
      hasPollinator: rec.pollinator_value !== undefined && rec.pollinator_value !== "" && Number.isFinite(Number(rec.pollinator_value)),
      hasNativeSupport: Boolean(rec.native_support?.trim()),
      hasExplicitEdible: edibleCell === "0" || edibleCell === "1",
    });
  }
  return map;
}

export type TraitCoverageRowDetail = {
  code: string;
  displayName: string;
  inCsv: boolean;
  dbOnly: boolean;
  effectiveWaterOk: boolean;
  effectiveSunOk: boolean;
  petSignalOk: boolean;
  edibleSignalOk: boolean;
  droughtSignalOk: boolean;
  /** CSV listed a numeric cooling_contribution (merge only applies when value > 0). */
  coolingCsvNumeric: boolean;
  /** Score lift for ranking: DB heat proxy (>1) or CSV-applied cooling > 1. */
  coolingUsable: boolean;
  mergedClimateTokensOk: boolean;
  weakDimensions: string[];
  weakScore: number;
};

export type CatalogHybridTraitCoverageReport = {
  schema_version: "heatwise.catalog_hybrid_trait_coverage.v1",
  generated_at: string;
  csv_path: string | null;
  extra_csv_only_merged: number;
  active_catalog_row_count: number;
  counts: {
    in_csv: number;
    db_only: number;
    effective_water_ok: number;
    effective_sun_ok: number;
    pet_signal_ok: number;
    edible_signal_ok: number;
    drought_signal_ok: number;
    cooling_csv_applied: number;
    cooling_csv_numeric_present: number;
    cooling_usable: number;
    csv_climate_ok: number;
    merged_climate_tokens_ok: number;
    weak_any: number;
  };
  rates: Record<string, number>;
  /** Weak-dimension tag → rows affected (sorted descending in summary). */
  gap_dimension_counts: { dimension: string; row_count: number }[];
  top_gaps: TraitCoverageRowDetail[];
  row_details: TraitCoverageRowDetail[];
  summary_lines: string[];
};

function weakDimensionsForRow(
  row: TraitRow,
  csv: CsvTraitPresence | undefined,
  effectiveWater: string,
  effectiveSun: string,
  coolingCsvApplied: boolean,
  edibleSignalOk: boolean,
  mergedClimateOk: boolean,
): { dims: string[]; score: number } {
  const dims: string[] = [];
  let score = 0;
  if (!effectiveWater) {
    dims.push("effective_water");
    score += 2;
  }
  if (!effectiveSun) {
    dims.push("effective_sun");
    score += 2;
  }
  if (row.childPetSafety == null) {
    dims.push("pet_tri_state");
    score += 1;
  }
  if (!edibleSignalOk) {
    dims.push("edible_signal");
    score += 1;
  }
  const droughtOk = row.dbDroughtTolerant === true || Boolean(row.dbDroughtToleranceStr?.trim());
  if (!droughtOk) {
    dims.push("drought_db");
    score += 1;
  }
  const coolingThin = row.coolingContribution <= 1.01 && !coolingCsvApplied;
  if (coolingThin) {
    dims.push("cooling_ranking_thin");
    score += 1;
  }
  if (!mergedClimateOk) {
    dims.push("climate_tokens");
    score += 1;
  }
  if (!csv?.hasContainerSuitability && !row.containerSuitability?.trim()) {
    dims.push("container_trait");
    score += 1;
  }
  return { dims, score };
}

function countGaps(details: TraitCoverageRowDetail[]): { dimension: string; row_count: number }[] {
  const acc = new Map<string, number>();
  for (const d of details) {
    for (const dim of d.weakDimensions) {
      acc.set(dim, (acc.get(dim) ?? 0) + 1);
    }
  }
  return [...acc.entries()]
    .map(([dimension, row_count]) => ({ dimension, row_count }))
    .sort((a, b) => b.row_count - a.row_count);
}

export function buildCatalogHybridTraitCoverageReport(input: {
  mergedRows: TraitRow[];
  csvPath: string | null;
  extraCsvOnlyMerged?: number;
}): CatalogHybridTraitCoverageReport {
  const { mergedRows, csvPath, extraCsvOnlyMerged = 0 } = input;
  const csvIndex = csvPath ? parseCsvForPresence(csvPath) : new Map<string, CsvTraitPresence>();
  const n = mergedRows.length;
  const detailList: TraitCoverageRowDetail[] = [];

  let inCsv = 0;
  let dbOnly = 0;
  let effective_water_ok = 0;
  let effective_sun_ok = 0;
  let pet_signal_ok = 0;
  let edible_signal_ok = 0;
  let drought_signal_ok = 0;
  let cooling_csv_applied = 0;
  let cooling_csv_numeric_present = 0;
  let cooling_usable = 0;
  let csv_climate_ok = 0;
  let merged_climate_tokens_ok = 0;
  let weak_any = 0;

  for (const row of mergedRows) {
    const csv = csvIndex.get(row.code);
    const inC = Boolean(csv);
    if (inC) inCsv++;
    else dbOnly++;

    const wEff = effectiveWaterDemandNorm(row);
    const sEff = effectiveSunlightPrefNorm(row);
    const waterOk = wEff !== "";
    const sunOk = sEff !== "";
    if (waterOk) effective_water_ok++;
    if (sunOk) effective_sun_ok++;

    const petOk = row.childPetSafety != null;
    if (petOk) pet_signal_ok++;

    const edibleOk = row.dbEdible !== null || Boolean(csv?.hasExplicitEdible);
    if (edibleOk) edible_signal_ok++;

    const droughtOk = row.dbDroughtTolerant === true || Boolean(row.dbDroughtToleranceStr?.trim());
    if (droughtOk) drought_signal_ok++;

    const coolingCsvNum = Boolean(csv?.hasCoolingContribution);
    if (coolingCsvNum) cooling_csv_numeric_present++;

    const csvApplied = (csv?.csvCoolingParsed ?? 0) > 0;
    if (csvApplied) cooling_csv_applied++;

    const coolingCsvNumeric = coolingCsvNum;
    const coolOk = row.coolingContribution > 1.01 || csvApplied;
    if (coolOk) cooling_usable++;

    if (csv?.hasClimateTokens) csv_climate_ok++;

    const mergedClim = (row.climateTokens?.length ?? 0) > 0;
    if (mergedClim) merged_climate_tokens_ok++;

    const { dims, score } = weakDimensionsForRow(
      row,
      csv,
      wEff,
      sEff,
      csvApplied,
      edibleOk,
      mergedClim,
    );
    if (dims.length > 0) weak_any++;

    detailList.push({
      code: row.code,
      displayName: row.displayName,
      inCsv: inC,
      dbOnly: !inC,
      effectiveWaterOk: waterOk,
      effectiveSunOk: sunOk,
      petSignalOk: petOk,
      edibleSignalOk: edibleOk,
      droughtSignalOk: droughtOk,
      coolingCsvNumeric: coolingCsvNumeric,
      coolingUsable: coolOk,
      mergedClimateTokensOk: mergedClim,
      weakDimensions: dims,
      weakScore: score,
    });
  }

  const rate = (c: number) => (n === 0 ? 0 : Math.round((c / n) * 1000) / 1000);
  const gap_dimension_counts = countGaps(detailList);
  const top_gaps = [...detailList].filter((d) => d.weakScore > 0).sort((a, b) => b.weakScore - a.weakScore).slice(0, 20);

  const gapSummary =
    gap_dimension_counts.length === 0
      ? "Top gap dimensions: (none — full coverage on scored weak tags)"
      : `Top gap dimensions by row count: ${gap_dimension_counts
          .slice(0, 8)
          .map((g) => `${g.dimension}=${g.row_count}`)
          .join(", ")}`;

  const summary_lines = [
    `Active catalog rows (merged): ${n}`,
    extraCsvOnlyMerged > 0
      ? `CSV-only species keys merged then excluded from counts: ${extraCsvOnlyMerged}`
      : `CSV-only species keys merged then excluded from counts: 0`,
    `CSV path: ${csvPath ?? "(none — DB-only fallback)"}`,
    `Rows with CSV row: ${inCsv} (${rate(inCsv)}), DB-only (no CSV line): ${dbOnly} (${rate(dbOnly)})`,
    `Effective water demand usable: ${effective_water_ok}/${n} (${rate(effective_water_ok)})`,
    `Effective sunlight preference usable: ${effective_sun_ok}/${n} (${rate(effective_sun_ok)})`,
    `Pet tri-state signal (non-null): ${pet_signal_ok}/${n} (${rate(pet_signal_ok)})`,
    `Edible signal (DB flag or CSV 0/1): ${edible_signal_ok}/${n} (${rate(edible_signal_ok)})`,
    `Drought DB signal (bool or droughtTolerance string): ${drought_signal_ok}/${n} (${rate(drought_signal_ok)})`,
    `Cooling CSV numeric cell present: ${cooling_csv_numeric_present}/${n} (${rate(cooling_csv_numeric_present)})`,
    `Cooling CSV applied to merge (value > 0): ${cooling_csv_applied}/${n} (${rate(cooling_csv_applied)})`,
    `Cooling usable for ranking (merged > 1.01 or CSV applied > 0): ${cooling_usable}/${n} (${rate(cooling_usable)})`,
    `CSV climate_suitability present: ${csv_climate_ok}/${n} (${rate(csv_climate_ok)})`,
    `Merged climate tokens (post-CSV): ${merged_climate_tokens_ok}/${n} (${rate(merged_climate_tokens_ok)}) — hot_arid / scarce-water hints`,
    `Rows with ≥1 weak ranking dimension: ${weak_any}/${n} (${rate(weak_any)})`,
    gapSummary,
  ];

  const counts = {
    in_csv: inCsv,
    db_only: dbOnly,
    effective_water_ok: effective_water_ok,
    effective_sun_ok: effective_sun_ok,
    pet_signal_ok: pet_signal_ok,
    edible_signal_ok: edible_signal_ok,
    drought_signal_ok: drought_signal_ok,
    cooling_csv_applied: cooling_csv_applied,
    cooling_csv_numeric_present: cooling_csv_numeric_present,
    cooling_usable: cooling_usable,
    csv_climate_ok: csv_climate_ok,
    merged_climate_tokens_ok: merged_climate_tokens_ok,
    weak_any: weak_any,
  };

  const rates: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) {
    rates[k] = rate(v);
  }

  return {
    schema_version: "heatwise.catalog_hybrid_trait_coverage.v1",
    generated_at: new Date().toISOString(),
    csv_path: csvPath,
    extra_csv_only_merged: extraCsvOnlyMerged,
    active_catalog_row_count: n,
    counts,
    rates,
    gap_dimension_counts,
    top_gaps,
    row_details: detailList,
    summary_lines,
  };
}

export type TraitCoverageCsvScope = "gaps" | "all";

export function traitCoverageReportToCsv(report: CatalogHybridTraitCoverageReport, scope: TraitCoverageCsvScope = "gaps"): string {
  const headers = [
    "code",
    "displayName",
    "inCsv",
    "dbOnly",
    "effectiveWaterOk",
    "effectiveSunOk",
    "petSignalOk",
    "edibleSignalOk",
    "droughtSignalOk",
    "coolingCsvNumeric",
    "coolingUsable",
    "mergedClimateTokensOk",
    "weakScore",
    "weakDimensions",
  ];
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  const rows = scope === "all" ? report.row_details : report.top_gaps;
  for (const r of rows) {
    lines.push(
      [
        esc(r.code),
        esc(r.displayName),
        r.inCsv ? "1" : "0",
        r.dbOnly ? "1" : "0",
        r.effectiveWaterOk ? "1" : "0",
        r.effectiveSunOk ? "1" : "0",
        r.petSignalOk ? "1" : "0",
        r.edibleSignalOk ? "1" : "0",
        r.droughtSignalOk ? "1" : "0",
        r.coolingCsvNumeric ? "1" : "0",
        r.coolingUsable ? "1" : "0",
        r.mergedClimateTokensOk ? "1" : "0",
        String(r.weakScore),
        esc(r.weakDimensions.join("|")),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}
