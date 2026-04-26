import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildEnrichmentResponseMeta } from "@/lib/enrichmentResponseMeta";
import type { RecommendationEnrichmentStatus } from "@/lib/ml/recommendationRuntimeTypes";

const baseStatus = (): RecommendationEnrichmentStatus => ({
  geo: "applied",
  supply: "applied",
  pricing: "applied",
  persistedGeoSnapshot: false,
  persistedConstraintSnapshot: false,
});

describe("buildEnrichmentResponseMeta", () => {
  it("marks degraded and partial when a phase failed", () => {
    const st = { ...baseStatus(), pricing: "failed" as const };
    const m = buildEnrichmentResponseMeta(st, []);
    assert.equal(m.enrichmentDegraded, true);
    assert.equal(m.enrichmentPartialSuccess, true);
  });

  it("marks partial but not degraded when only warnings exist", () => {
    const m = buildEnrichmentResponseMeta(baseStatus(), [
      { phase: "geo", code: "PERSIST_FAILED", message: "db" },
    ]);
    assert.equal(m.enrichmentDegraded, false);
    assert.equal(m.enrichmentPartialSuccess, true);
  });

  it("ignores shadow_eval warnings for partial flag", () => {
    const m = buildEnrichmentResponseMeta(baseStatus(), [
      { phase: "shadow_eval", code: "SHADOW_RUNTIME_FAILED", message: "x" },
    ]);
    assert.equal(m.enrichmentPartialSuccess, false);
  });
});
