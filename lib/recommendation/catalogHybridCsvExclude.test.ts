/**
 * Catalog-hybrid species_features CSV policy from the shared mapping artifact.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SPECIES_CATALOG_MAPPING_V1 } from "@/lib/species/speciesCatalogMapping";

describe("catalog hybrid CSV merge policy (mapping artifact)", () => {
  it("quarantines ambiguous / training-only raw keys from hybrid merge", () => {
    const ex = SPECIES_CATALOG_MAPPING_V1.speciesFeatureKeysExcludeFromCatalogHybrid ?? [];
    assert.ok(ex.includes("ridge_gourd_alt"));
    assert.ok(ex.includes("cactus_mix"));
  });

  it("aliases tomato_dwarf to cherry_tomato for a single tomato bucket", () => {
    const sf = SPECIES_CATALOG_MAPPING_V1.speciesFeatureKeyAliases ?? {};
    assert.equal(sf["tomato_dwarf"], "cherry_tomato");
  });
});
