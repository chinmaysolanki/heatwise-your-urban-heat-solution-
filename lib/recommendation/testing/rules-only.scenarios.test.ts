/**
 * Rules-only TS fallback (no Prisma). Mirrors python template spirit when ML is down.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildRulesOnlyFallback } from "@/lib/recommendation/rulesOnlyFallback";
import { RECOMMENDATION_TEST_SCENARIOS } from "@/lib/recommendation/testing/scenarios";
import {
  assertBudgetSanity,
  assertLayoutEligibility,
  assertMinOpen,
  assertNonEmptyResponse,
  assertRankingSanity,
  openCandidates,
} from "@/lib/recommendation/testing/assertions";

describe("Rules-only fallback — scenario coverage", () => {
  for (const scenario of RECOMMENDATION_TEST_SCENARIOS) {
    it(`${scenario.id}: non-empty open slate`, () => {
      assertLayoutEligibility(scenario);
      const res = buildRulesOnlyFallback(scenario.request);
      assert.equal(res.telemetryMeta?.generatorSource, "live_rules");
      assert.equal(res.mode, "rules_only");
      const min = scenario.expect.rulesOnlyMinOpen ?? scenario.expect.catalogHybridMinOpen ?? 1;
      assertMinOpen(res, min);
      assertNonEmptyResponse(res);
      assertRankingSanity(res);
      if (scenario.expect.maxBudgetInr != null) {
        assertBudgetSanity(res, scenario.expect.maxBudgetInr);
      }
      const labels = openCandidates(res).map(
        (c) => String((c.candidatePayload as Record<string, unknown>).species_primary ?? ""),
      );
      assert.ok(labels.some(Boolean), "species_primary present");
    });
  }
});
