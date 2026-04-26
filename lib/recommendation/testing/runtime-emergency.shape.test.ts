/**
 * Documented shape when catalog hybrid escalates to emergency rules-only.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RecommendationGenerateResponse } from "@/lib/ml/recommendationRuntimeTypes";
import { assertRulesOnlyEmergency } from "@/lib/recommendation/testing/assertions";

describe("Emergency rules-only response shape", () => {
  it("matches assertions used for telemetry / observability", () => {
    const res: RecommendationGenerateResponse = {
      mode: "rules_only",
      candidates: [
        {
          candidateId: "x",
          rank: 1,
          blocked: false,
          scores: { blended: 0.7, blendParts: { rules: 0.7 } },
          candidatePayload: { species_primary: "Spider Plant" },
          explanation: { summaryBullets: ["ok"] },
        },
      ],
      telemetryMeta: {
        generatorSource: "live_rules",
        rulesVersion: "hw-rules-test",
        modelVersionFeasibility: null,
        modelVersionHeat: null,
        modelVersionRanking: null,
        mlErrors: [
          "python_runtime_unavailable_ts_fallback",
          "catalog_hybrid_no_species_data_emergency_rules_only",
          "catalog_fallback_reason:python_nonzero_exit",
        ],
      },
      runExplanation: { mode: "rules_only", note: "test" },
      errors: [],
    };
    assertRulesOnlyEmergency(res);
  });
});
