/**
 * Unit tests for catalog-hybrid trait merge / effective-norm helpers (no DB).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyMergedTraitFallbacks,
  effectiveSunlightPrefNorm,
  effectiveWaterDemandNorm,
  reconcileChildPetSafety,
  type TraitRow,
} from "@/lib/recommendation/catalogHybridFallback";

function baseTrait(over: Partial<TraitRow>): TraitRow {
  return {
    code: "x",
    displayName: "X",
    childPetSafety: null,
    climateTokens: [],
    sunlightPreference: null,
    waterDemand: null,
    maintenanceNeed: null,
    containerSuitability: null,
    coolingContribution: 1,
    edible: false,
    pollinatorValue: 0,
    nativeSupport: null,
    dbPetSafe: null,
    dbHeatTolerant: null,
    dbDroughtTolerant: null,
    dbDroughtToleranceStr: null,
    dbLowMaintenance: null,
    dbEdible: null,
    mlWeight: null,
    minSunHours: null,
    dbFlowering: null,
    ...over,
  };
}

describe("catalogHybrid trait merge helpers", () => {
  it("reconcileChildPetSafety picks stricter label (CSV UNSAFE vs DB SAFE)", () => {
    assert.equal(reconcileChildPetSafety("UNSAFE", true), "UNSAFE");
    assert.equal(reconcileChildPetSafety("SAFE", false), "UNSAFE");
    assert.equal(reconcileChildPetSafety("CAUTION", true), "CAUTION");
    assert.equal(reconcileChildPetSafety("CAUTION", false), "UNSAFE");
    assert.equal(reconcileChildPetSafety(null, false), "UNSAFE");
    assert.equal(reconcileChildPetSafety(null, true), "SAFE");
    assert.equal(reconcileChildPetSafety("SAFE", null), "SAFE");
  });

  it("effectiveWaterDemandNorm prefers CSV bucket then DB flags", () => {
    assert.equal(
      effectiveWaterDemandNorm({
        waterDemand: "HIGH",
        dbDroughtTolerant: true,
        dbDroughtToleranceStr: null,
      }),
      "HIGH",
    );
    assert.equal(
      effectiveWaterDemandNorm({
        waterDemand: "",
        dbDroughtTolerant: true,
        dbDroughtToleranceStr: null,
      }),
      "LOW",
    );
  });

  it("effectiveWaterDemandNorm maps legacy droughtTolerance HIGH -> LOW demand", () => {
    assert.equal(
      effectiveWaterDemandNorm({
        waterDemand: null,
        dbDroughtTolerant: false,
        dbDroughtToleranceStr: "HIGH",
      }),
      "LOW",
    );
    assert.equal(
      effectiveWaterDemandNorm({
        waterDemand: null,
        dbDroughtTolerant: false,
        dbDroughtToleranceStr: "LOW",
      }),
      "HIGH",
    );
  });

  it("effectiveSunlightPrefNorm derives from minSunHours when pref missing", () => {
    assert.equal(
      effectiveSunlightPrefNorm({ sunlightPreference: null, minSunHours: 8 }),
      "FULL",
    );
    assert.equal(
      effectiveSunlightPrefNorm({ sunlightPreference: "", minSunHours: 2 }),
      "SHADE",
    );
    assert.equal(
      effectiveSunlightPrefNorm({ sunlightPreference: "", minSunHours: 5 }),
      "PART",
    );
    assert.equal(effectiveSunlightPrefNorm({ sunlightPreference: "shade", minSunHours: null }), "SHADE");
  });

  it("applyMergedTraitFallbacks fills water and sun from DB proxies", () => {
    const row = baseTrait({
      dbDroughtTolerant: true,
      minSunHours: 8,
    });
    applyMergedTraitFallbacks(row);
    assert.equal(row.waterDemand, "LOW");
    assert.equal(row.sunlightPreference, "FULL");
  });

  it("applyMergedTraitFallbacks does not overwrite CSV water", () => {
    const row = baseTrait({
      waterDemand: "MED",
      dbDroughtTolerant: true,
    });
    applyMergedTraitFallbacks(row);
    assert.equal(row.waterDemand, "MED");
  });
});
