/**
 * Layout attachment preconditions (no ML).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getLayoutEligibility } from "@/lib/recommendation/layoutEligibility";
import { layoutEligibleProject, RECOMMENDATION_TEST_SCENARIOS } from "@/lib/recommendation/testing/scenarios";

describe("getLayoutEligibility", () => {
  for (const scenario of RECOMMENDATION_TEST_SCENARIOS) {
    if (!scenario.expect.layoutEligible) continue;
    it(`eligible: ${scenario.id}`, () => {
      const r = getLayoutEligibility(scenario.request);
      assert.equal(r.eligible, true, r.ineligibleReason ?? "");
      assert.ok(r.projectInput);
    });
  }

  it("ineligible without floor dimensions", () => {
    const r = getLayoutEligibility({
      project: {
        project_type: "balcony",
        space_kind: "balcony",
        budget_inr: 80_000,
      },
      environment: {},
      preferences: {},
    });
    assert.equal(r.eligible, false);
    assert.equal(r.ineligibleReason, "MISSING_FLOOR_DIMENSIONS");
  });

  it("ineligible unsupported space", () => {
    const r = getLayoutEligibility({
      project: {
        ...layoutEligibleProject("balcony"),
        space_kind: "indoor",
        project_type: "indoor",
      },
      environment: {},
      preferences: {},
    });
    assert.equal(r.eligible, false);
    assert.equal(r.ineligibleReason, "UNSUPPORTED_SPACE_TYPE");
  });
});
