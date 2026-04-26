/**
 * Trait coverage / CSV-merge audit for catalogHybridFallback species rows.
 *
 * Uses the same merge path as production (DB active catalog + species_features CSV).
 *
 * Examples:
 *   npx tsx scripts/catalog-hybrid-trait-coverage-audit.ts
 *   npx tsx scripts/catalog-hybrid-trait-coverage-audit.ts --csv /path/to/species_features.csv
 *   npx tsx scripts/catalog-hybrid-trait-coverage-audit.ts --db-only
 *   npx tsx scripts/catalog-hybrid-trait-coverage-audit.ts --json reports/catalog-trait-coverage.json
 *   npx tsx scripts/catalog-hybrid-trait-coverage-audit.ts --csv-out reports/weak-rows.csv --csv-scope all
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { loadMergedCatalogHybridTraitRows } from "@/lib/recommendation/catalogHybridFallback";
import {
  buildCatalogHybridTraitCoverageReport,
  traitCoverageReportToCsv,
} from "@/lib/recommendation/catalogHybridTraitCoverageAudit";

function parseArgs(argv: string[]) {
  let speciesCsvPath: string | null | undefined = undefined;
  let dbOnly = false;
  let jsonOut: string | null = null;
  let csvOut: string | null = null;
  let csvScope: "gaps" | "all" = "gaps";

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--db-only") dbOnly = true;
    else if (a === "--json" && argv[i + 1]) {
      jsonOut = argv[++i]!;
    } else if (a === "--csv-out" && argv[i + 1]) {
      csvOut = argv[++i]!;
    } else if (a === "--csv-scope" && argv[i + 1]) {
      const v = argv[++i]!;
      if (v === "all" || v === "gaps") csvScope = v;
      else {
        console.error(`Unknown --csv-scope "${v}" (use gaps|all)`);
        process.exit(1);
      }
    } else if (a === "--csv" && argv[i + 1]) {
      speciesCsvPath = argv[++i]!;
    } else if (a === "--help" || a === "-h") {
      console.log(`catalog-hybrid-trait-coverage-audit — see script header`);
      process.exit(0);
    }
  }

  if (dbOnly) speciesCsvPath = null;
  return { speciesCsvPath, dbOnly, jsonOut, csvOut, csvScope };
}

async function main() {
  const { speciesCsvPath, jsonOut, csvOut, csvScope } = parseArgs(process.argv);

  const { rows, csvPath, extraCsvOnlyRowCount } = await loadMergedCatalogHybridTraitRows({
    speciesCsvPath,
  });

  const report = buildCatalogHybridTraitCoverageReport({
    mergedRows: rows,
    csvPath,
    extraCsvOnlyMerged: extraCsvOnlyRowCount,
  });

  for (const line of report.summary_lines) {
    console.log(line);
  }

  if (jsonOut) {
    const abs = path.isAbsolute(jsonOut) ? jsonOut : path.resolve(process.cwd(), jsonOut);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(report, null, 2), "utf8");
    console.log(`\nWrote JSON: ${abs}`);
  }

  if (csvOut) {
    const abs = path.isAbsolute(csvOut) ? csvOut : path.resolve(process.cwd(), csvOut);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, traitCoverageReportToCsv(report, csvScope), "utf8");
    console.log(`Wrote CSV (${csvScope}): ${abs}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
