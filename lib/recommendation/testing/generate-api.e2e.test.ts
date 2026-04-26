/**
 * API/orchestration E2E: POST /api/recommendations/generate (handler invoked in-process).
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type {
  RecommendationGenerateResponse,
  LayoutSlateMeta,
} from "@/lib/ml/recommendationRuntimeTypes";
import generateHandler from "@/pages/api/recommendations/generate";
import {
  createFailingPythonStub,
  createMockResponse,
  createPostRequest,
  invokeRecommendationsGenerate,
} from "@/lib/recommendation/testing/api/invokeRecommendationsGenerate";
import { RECOMMENDATION_TEST_SCENARIOS } from "@/lib/recommendation/testing/scenarios";

describe("POST /api/recommendations/generate (E2E orchestration)", () => {
  const stubs: Array<{ cleanup: () => void }> = [];
  let prevMlPython: string | undefined;

  beforeEach(() => {
    prevMlPython = process.env.HEATWISE_ML_PYTHON;
    const stub = createFailingPythonStub();
    stubs.push(stub);
    process.env.HEATWISE_ML_PYTHON = stub.executablePath;
  });

  afterEach(() => {
    while (stubs.length) stubs.pop()!.cleanup();
    if (prevMlPython === undefined) delete process.env.HEATWISE_ML_PYTHON;
    else process.env.HEATWISE_ML_PYTHON = prevMlPython;
  });

  function eligibleFastRequest() {
    const s = RECOMMENDATION_TEST_SCENARIOS.find((x) => x.id === "sunny_balcony_low_maintenance")!;
    return {
      ...s.request,
      skipGeoEnrichment: true,
      skipPricingEnrichment: true,
      skipSupplyConstraints: true,
    };
  }

  it("eligible request: layoutSlate is terminal (attached | failed), never silent success without slate", async () => {
    const res = createMockResponse();
    const { statusCode, body } = await invokeRecommendationsGenerate(
      createPostRequest(eligibleFastRequest()),
      res,
      generateHandler,
    );
    assert.equal(statusCode, 200);
    const data = body as RecommendationGenerateResponse;
    assert.ok(data.layoutSlate, "layoutSlate must always be set");
    const slate = data.layoutSlate as LayoutSlateMeta;
    assert.equal(slate.eligible, true);
    assert.ok(slate.status === "attached" || slate.status === "failed", `status=${slate.status}`);
    if (slate.status === "attached") {
      assert.ok(data.layoutGeneration, "attached slate requires layoutGeneration");
      assert.ok(
        Array.isArray(data.layoutGeneration!.recommendations) &&
          data.layoutGeneration!.recommendations.length > 0,
      );
    } else {
      assert.ok(slate.failureCode, "failed slate must expose failureCode");
      assert.ok(!data.layoutGeneration, "failed slate must not attach layoutGeneration");
    }
  });

  it("ineligible request: skipped_ineligible and no layoutGeneration", async () => {
    const res = createMockResponse();
    const { statusCode, body } = await invokeRecommendationsGenerate(
      createPostRequest({
        project: {
          project_type: "balcony",
          space_kind: "balcony",
          budget_inr: 80_000,
        },
        environment: {},
        preferences: {},
        skipGeoEnrichment: true,
        skipPricingEnrichment: true,
        skipSupplyConstraints: true,
      }),
      res,
      generateHandler,
    );
    assert.equal(statusCode, 200);
    const data = body as RecommendationGenerateResponse;
    const slate = data.layoutSlate!;
    assert.equal(slate.eligible, false);
    assert.equal(slate.status, "skipped_ineligible");
    assert.ok(slate.ineligibleReason);
    assert.ok(!data.layoutGeneration);
  });

  it("returns candidates and telemetryMeta with coherent fallback when Python is stubbed out", async () => {
    const res = createMockResponse();
    const { statusCode, body } = await invokeRecommendationsGenerate(
      createPostRequest(eligibleFastRequest()),
      res,
      generateHandler,
    );
    assert.equal(statusCode, 200);
    const data = body as RecommendationGenerateResponse;
    assert.ok(Array.isArray(data.candidates) && data.candidates.length > 0);
    assert.ok(data.telemetryMeta && typeof data.telemetryMeta.generatorSource === "string");
    const gen = data.telemetryMeta.generatorSource;
    assert.ok(
      gen === "catalog_hybrid_ts" || gen === "live_rules" || gen === "hybrid",
      `unexpected generatorSource: ${gen}`,
    );
    const errs = (data.telemetryMeta.mlErrors ?? []).map((e) => String(e));
    assert.ok(
      errs.some(
        (e) =>
          e.toLowerCase().includes("python") ||
          e.includes("catalog") ||
          e.includes("fallback") ||
          e.includes("exit_"),
      ),
      `expected fallback hints in mlErrors, got ${JSON.stringify(errs)}`,
    );
    assert.ok(data.mode === "partial_ml" || data.mode === "rules_only" || data.mode === "full_ml");
  });

  it("rejects non-POST with 405", async () => {
    const res = createMockResponse();
    const req = {
      method: "GET",
      query: {},
      headers: {},
    } as import("next").NextApiRequest;
    await invokeRecommendationsGenerate(req, res, generateHandler);
    const { statusCode, body } = res.getCaptured();
    assert.equal(statusCode, 405);
    assert.ok(body && typeof body === "object" && "error" in (body as object));
  });

  it("rejects invalid body with 400", async () => {
    const res = createMockResponse();
    const req = {
      method: "POST",
      body: { project: {} },
      query: {},
      headers: {},
    } as unknown as import("next").NextApiRequest;
    await invokeRecommendationsGenerate(req, res, generateHandler);
    const { statusCode, body } = res.getCaptured();
    assert.equal(statusCode, 400);
    const b = body as { error?: { code?: string } };
    assert.equal(b.error?.code, "INVALID_BODY");
  });

  it("eligible terrace: layout slate is always explicit (attached or failed)", async () => {
    const s = RECOMMENDATION_TEST_SCENARIOS.find((x) => x.id === "hot_terrace_cooling")!;
    const res = createMockResponse();
    const { statusCode, body } = await invokeRecommendationsGenerate(
      createPostRequest({
        ...s.request,
        skipGeoEnrichment: true,
        skipPricingEnrichment: true,
        skipSupplyConstraints: true,
      }),
      res,
      generateHandler,
    );
    assert.equal(statusCode, 200);
    const data = body as RecommendationGenerateResponse;
    assert.ok(data.layoutSlate?.eligible === true);
    assert.ok(data.layoutSlate?.status === "attached" || data.layoutSlate?.status === "failed");
  });

  it("windy high-rise eligible balcony still returns explicit layoutSlate", async () => {
    const s = RECOMMENDATION_TEST_SCENARIOS.find((x) => x.id === "windy_highrise_balcony")!;
    const res = createMockResponse();
    const { statusCode, body } = await invokeRecommendationsGenerate(
      createPostRequest({
        ...s.request,
        skipGeoEnrichment: true,
        skipPricingEnrichment: true,
        skipSupplyConstraints: true,
      }),
      res,
      generateHandler,
    );
    assert.equal(statusCode, 200);
    const data = body as RecommendationGenerateResponse;
    assert.ok(data.layoutSlate);
    assert.equal(data.layoutSlate!.eligible, true);
  });
});
