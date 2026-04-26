/**
 * JSON usability contract for Python stdout → Node (no subprocess).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pythonRecommendationPayloadUnusableReason } from "@/lib/services/mlRecommendationService";

describe("pythonRecommendationPayloadUnusableReason", () => {
  it("accepts minimal usable hybrid-shaped payload", () => {
    const payload = {
      mode: "partial_ml",
      heatwiseServingOk: true,
      telemetryMeta: { generatorSource: "hybrid", rulesVersion: "x", mlErrors: [] },
      candidates: [
        {
          candidateId: "a",
          rank: 1,
          blocked: false,
          scores: { blended: 0.8 },
          explanation: { summaryBullets: [] },
          candidatePayload: { species_primary: "Mint" },
        },
      ],
    };
    assert.equal(pythonRecommendationPayloadUnusableReason(payload), null);
  });

  it("rejects empty candidates", () => {
    const payload = {
      mode: "full_ml",
      telemetryMeta: { generatorSource: "x", rulesVersion: "x", mlErrors: [] },
      candidates: [],
    };
    assert.equal(pythonRecommendationPayloadUnusableReason(payload), "unusable_empty_candidates");
  });

  it("rejects all blocked", () => {
    const payload = {
      mode: "full_ml",
      telemetryMeta: { generatorSource: "x", rulesVersion: "x", mlErrors: [] },
      candidates: [
        { candidateId: "a", rank: 1, blocked: true, scores: { blended: 0 }, explanation: { summaryBullets: [] } },
      ],
    };
    assert.equal(pythonRecommendationPayloadUnusableReason(payload), "unusable_all_candidates_blocked");
  });

  it("rejects heatwiseServingOk false", () => {
    const payload = {
      heatwiseServingOk: false,
      mode: "rules_only",
      telemetryMeta: { generatorSource: "x", rulesVersion: "x", mlErrors: [] },
      candidates: [{ candidateId: "a", rank: 1, blocked: false, scores: { blended: 1 }, explanation: {} }],
    };
    assert.equal(pythonRecommendationPayloadUnusableReason(payload), "unusable_heatwise_serving_ok_false");
  });

  it("rejects invalid mode", () => {
    const payload = {
      mode: "invalid",
      telemetryMeta: { generatorSource: "x", rulesVersion: "x", mlErrors: [] },
      candidates: [{ candidateId: "a", rank: 1, blocked: false, scores: { blended: 1 }, explanation: {} }],
    };
    assert.equal(pythonRecommendationPayloadUnusableReason(payload), "unusable_invalid_mode");
  });
});
