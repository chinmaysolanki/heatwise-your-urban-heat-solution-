/**
 * Optional subprocess test: real Python serving. Opt-in: HEATWISE_RUN_ML_INTEGRATION=1
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RECOMMENDATION_TEST_SCENARIOS } from "@/lib/recommendation/testing/scenarios";
import { assertMinOpen, assertRankingSanity, openCandidates } from "@/lib/recommendation/testing/assertions";
import { generateRecommendationsRuntime } from "@/lib/services/mlRecommendationService";

const RUN = process.env.HEATWISE_RUN_ML_INTEGRATION === "1";

describe("ML integration (Python subprocess)", () => {
  it("first scenario hits usable Python or catalog hybrid", async (t) => {
    if (!RUN) {
      t.skip("set HEATWISE_RUN_ML_INTEGRATION=1 to run");
      return;
    }
    const reg = fs.mkdtempSync(path.join(os.tmpdir(), "hw-reg-empty-"));
    const scenario = RECOMMENDATION_TEST_SCENARIOS[0]!;
    const req = {
      ...scenario.request,
      registryDir: reg,
      maxCandidates: 4,
    };
    const res = await generateRecommendationsRuntime(req);
    const src = res.telemetryMeta?.generatorSource;
    assert.ok(
      src === "hybrid" || src === "catalog_hybrid_ts" || src === "live_rules",
      `unexpected generator ${src}`,
    );
    assertMinOpen(res, 1);
    assertRankingSanity(res);
    if (src === "hybrid" || src === "live_rules") {
      const open = openCandidates(res);
      assert.ok(open.length > 0);
    }
  });
});
