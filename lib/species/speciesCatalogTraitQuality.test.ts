/**
 * Unit tests for species catalog trait quality rules.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DROUGHT_TOLERANCE_LEVELS,
  partitionTraitIssues,
  validateSpeciesTraitRow,
  validateSpeciesTraitRows,
  type SpeciesTraitQualityRow,
} from "@/lib/species/speciesCatalogTraitQuality";

function row(partial: Partial<SpeciesTraitQualityRow> & Pick<SpeciesTraitQualityRow, "code">): SpeciesTraitQualityRow {
  return {
    droughtTolerance: null,
    droughtTolerant: false,
    minSunHours: null,
    maxSunHours: null,
    petSafe: true,
    edible: true,
    category: null,
    sunExposure: null,
    ...partial,
  };
}

describe("speciesCatalogTraitQuality", () => {
  it("allows standard droughtTolerance vocabulary", () => {
    for (const tol of DROUGHT_TOLERANCE_LEVELS) {
      const issues = validateSpeciesTraitRow(
        row({
          code: "t",
          droughtTolerance: tol,
          droughtTolerant: tol !== "LOW",
        }),
      );
      assert.ok(
        !issues.some((i) => i.message.includes("not in allowed")),
        `tol=${tol}`,
      );
    }
  });

  it("errors on unknown droughtTolerance string", () => {
    const issues = validateSpeciesTraitRow(row({ code: "x", droughtTolerance: "WET", droughtTolerant: true }));
    assert.ok(issues.some((i) => i.level === "error" && i.message.includes("not in allowed")));
  });

  it("errors when HIGH tolerance string contradicts droughtTolerant=false", () => {
    const issues = validateSpeciesTraitRow(
      row({ code: "x", droughtTolerance: "HIGH", droughtTolerant: false }),
    );
    assert.ok(issues.some((i) => i.level === "error" && i.message.includes("contradicts")));
  });

  it("errors when LOW tolerance contradicts droughtTolerant=true", () => {
    const issues = validateSpeciesTraitRow(
      row({ code: "x", droughtTolerance: "LOW", droughtTolerant: true }),
    );
    assert.ok(issues.some((i) => i.level === "error" && i.message.includes("contradicts")));
  });

  it("errors on minSunHours > maxSunHours", () => {
    const issues = validateSpeciesTraitRow(
      row({ code: "x", minSunHours: 8, maxSunHours: 4 }),
    );
    assert.ok(issues.some((i) => i.level === "error" && i.message.includes(">")));
  });

  it("errors HERB with edible false", () => {
    const issues = validateSpeciesTraitRow(
      row({ code: "x", category: "HERB", edible: false, petSafe: true }),
    );
    assert.ok(issues.some((i) => i.level === "error" && i.message.includes("HERB")));
  });

  it("detects duplicate codes in batch", () => {
    const issues = validateSpeciesTraitRows([
      row({ code: "a", droughtTolerance: "HIGH", droughtTolerant: true }),
      row({ code: "a", droughtTolerance: "HIGH", droughtTolerant: true }),
    ]);
    const { errors } = partitionTraitIssues(issues);
    assert.ok(errors.some((e) => e.message.includes("duplicate")));
  });
});
