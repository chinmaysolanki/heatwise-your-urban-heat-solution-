/**
 * SpeciesCatalog.code resolution on runtime candidates (no DB).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RuntimeCandidate } from "@/lib/ml/recommendationRuntimeTypes";
import { resolveSpeciesIdentityFromRuntimeCandidate } from "@/lib/species/resolveSpeciesCatalogCode";

function cand(payload: Record<string, unknown>): RuntimeCandidate {
  return {
    candidateId: "t",
    rank: 1,
    blocked: false,
    scores: { blended: 0.5 },
    candidatePayload: payload,
    explanation: { summaryBullets: [] },
  };
}

describe("resolveSpeciesIdentityFromRuntimeCandidate", () => {
  it("uses explicit species_catalog_code when present", () => {
    const r = resolveSpeciesIdentityFromRuntimeCandidate(
      cand({ species_primary: "Mint", species_catalog_code: "mint" }),
    );
    assert.equal(r.catalogCode, "mint");
    assert.equal(r.resolution, "payload_catalog_code");
  });

  it("resolves display label via mapping artifact", () => {
    const r = resolveSpeciesIdentityFromRuntimeCandidate(cand({ species_primary: "Periwinkle (Vinca)" }));
    assert.equal(r.catalogCode, "vinca");
    assert.ok(r.resolution === "ml_payload_resolved" || r.resolution === "canonical_alias");
  });

  it("does not invent code for unknown labels", () => {
    const r = resolveSpeciesIdentityFromRuntimeCandidate(
      cand({ species_primary: "Completely Unknown Species XYZ" }),
    );
    assert.equal(r.catalogCode, null);
    assert.equal(r.resolution, "unresolved");
  });
});
