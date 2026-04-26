/**
 * Catalog hybrid TS path (Prisma SpeciesCatalog + optional CSV). Skips when DB unavailable.
 */

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { db } from "@/lib/db";
import { buildCatalogHybridFallback } from "@/lib/recommendation/catalogHybridFallback";
import { RECOMMENDATION_TEST_SCENARIOS } from "@/lib/recommendation/testing/scenarios";
import {
  assertAtLeastOneOpenCodeFrom,
  assertAtLeastOneOpenCodeFromInTop,
  assertBudgetSanity,
  assertCatalogHybridPath,
  assertEdibleDominanceInTopOpen,
  assertForbiddenCodesInTopOpen,
  assertForbiddenOpenCatalogCodes,
  assertLayoutEligibility,
  assertMinOpen,
  assertNoOpenBougainvillea,
  assertNonEmptyResponse,
  assertOpenAvoidSprinklerMistInScarceWater,
  assertRankingSanity,
  assertSomeOpenEdibleCode,
  assertTopOpenHaveCatalogCodes,
  openCandidates,
} from "@/lib/recommendation/testing/assertions";

let skipCatalogHybrid = false;
let skipReason = "";

before(async () => {
  if (process.env.SKIP_RECOMMENDATION_DB_TESTS === "1") {
    skipCatalogHybrid = true;
    skipReason = "SKIP_RECOMMENDATION_DB_TESTS=1";
    return;
  }
  try {
    const n = await db.speciesCatalog.count({ where: { active: true } });
    if (n === 0) {
      skipCatalogHybrid = true;
      skipReason = "no active SpeciesCatalog rows";
    }
  } catch (e) {
    skipCatalogHybrid = true;
    skipReason = e instanceof Error ? e.message : "db error";
  }
});

describe("Catalog hybrid — scenario coverage", () => {
  for (const scenario of RECOMMENDATION_TEST_SCENARIOS) {
    it(scenario.id, async (t) => {
      if (skipCatalogHybrid) {
        t.skip(skipReason || "catalog hybrid skipped");
        return;
      }
      assertLayoutEligibility(scenario);
      const res = await buildCatalogHybridFallback(scenario.request, {
        fallbackReason: "python_nonzero_exit",
        pythonExitCode: 1,
        stderr: "forced_fallback_for_test",
      });
      assertCatalogHybridPath(res);
      const min = scenario.expect.catalogHybridMinOpen ?? 1;
      assertMinOpen(res, min);
      if (min >= 1) {
        assertNonEmptyResponse(res);
      }
      assertRankingSanity(res);

      if (scenario.expect.catalogHybridCodesRequired && min >= 1) {
        assertTopOpenHaveCatalogCodes(res, Math.min(5, openCandidates(res).length));
      }
      if (scenario.expect.petSafeNoBougainvilleaOpen) {
        assertNoOpenBougainvillea(res);
      }
      if (scenario.expect.edibleCodeAmongOpen) {
        assertSomeOpenEdibleCode(res);
      }
      if (scenario.expect.waterScarceNoSprinklerMistOpen) {
        assertOpenAvoidSprinklerMistInScarceWater(res);
      }
      if (scenario.expect.forbiddenOpenCatalogCodes?.length) {
        assertForbiddenOpenCatalogCodes(res, scenario.expect.forbiddenOpenCatalogCodes);
      }
      if (scenario.expect.requireOpenCatalogCodeOneOf?.length) {
        assertAtLeastOneOpenCodeFrom(res, scenario.expect.requireOpenCatalogCodeOneOf);
      }
      const topAnchor = scenario.expect.requireOpenCatalogCodeOneOfInTop;
      if (topAnchor?.codes?.length) {
        assertAtLeastOneOpenCodeFromInTop(res, topAnchor.topN, topAnchor.codes);
      }
      if (scenario.expect.edibleDominanceTopOpen) {
        const { k, min } = scenario.expect.edibleDominanceTopOpen;
        assertEdibleDominanceInTopOpen(res, k, min);
      }
      const topForbidden = scenario.expect.forbiddenOpenCatalogCodesInTop;
      if (topForbidden?.codes?.length) {
        assertForbiddenCodesInTopOpen(res, topForbidden.topN, topForbidden.codes);
      }
      if (scenario.expect.maxBudgetInr != null) {
        assertBudgetSanity(res, scenario.expect.maxBudgetInr);
      }

      assert.ok(
        (res.telemetryMeta?.mlErrors ?? []).some((m) => String(m).includes("catalog_fallback_reason:")),
        "telemetry should record fallback reason",
      );
    });
  }
});
