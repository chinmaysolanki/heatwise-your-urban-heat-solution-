/**
 * Shared assertions for recommendation scenario tests.
 */

import assert from "node:assert/strict";

import type { RecommendationGenerateResponse, RuntimeCandidate } from "@/lib/ml/recommendationRuntimeTypes";
import { getLayoutEligibility } from "@/lib/recommendation/layoutEligibility";
import type { RecommendationTestScenario } from "@/lib/recommendation/testing/scenarios";
import { EDIBLE_CATALOG_CODES } from "@/lib/recommendation/testing/scenarios";

export function openCandidates(res: RecommendationGenerateResponse): RuntimeCandidate[] {
  return (res.candidates ?? []).filter((c) => !c.blocked);
}

export function assertNonEmptyResponse(res: RecommendationGenerateResponse): void {
  assert.ok(res.candidates && res.candidates.length > 0, "response has candidates[]");
  assert.ok(openCandidates(res).length > 0, "at least one non-blocked candidate");
}

export function assertMinOpen(res: RecommendationGenerateResponse, min: number): void {
  const n = openCandidates(res).length;
  assert.ok(
    n >= min,
    `expected at least ${min} open candidates, got ${n} (blocked: ${(res.candidates ?? []).filter((c) => c.blocked).length})`,
  );
}

export function assertCatalogHybridPath(res: RecommendationGenerateResponse): void {
  assert.equal(res.telemetryMeta?.generatorSource, "catalog_hybrid_ts");
  assert.ok(res.mode === "partial_ml" || res.mode === "full_ml", `unexpected mode ${res.mode}`);
}

export function assertRulesOnlyEmergency(res: RecommendationGenerateResponse): void {
  assert.equal(res.mode, "rules_only");
  assert.equal(res.telemetryMeta?.generatorSource, "live_rules");
  const errs = (res.telemetryMeta?.mlErrors ?? []).join(" ");
  assert.ok(
    errs.includes("catalog_hybrid_no_species_data") || errs.includes("catalog_hybrid_all_species_filtered"),
    `expected emergency catalog hybrid markers in mlErrors, got: ${errs}`,
  );
}

export function assertTopOpenHaveCatalogCodes(res: RecommendationGenerateResponse, topN: number): void {
  const open = openCandidates(res).slice(0, topN);
  assert.ok(open.length > 0, "no open candidates to check codes");
  for (const c of open) {
    const code = String((c.candidatePayload as Record<string, unknown>).species_catalog_code ?? "").trim();
    assert.ok(code.length > 0, `open candidate ${c.candidateId} missing species_catalog_code`);
  }
}

export function assertNoOpenBougainvillea(res: RecommendationGenerateResponse): void {
  for (const c of openCandidates(res)) {
    const p = c.candidatePayload as Record<string, unknown>;
    const code = String(p.species_catalog_code ?? "").toLowerCase();
    const name = String(p.species_primary ?? "").toLowerCase();
    assert.notEqual(code, "bougainvillea");
    assert.notEqual(name, "bougainvillea");
  }
}

export function assertSomeOpenEdibleCode(res: RecommendationGenerateResponse): void {
  const codes = openCandidates(res)
    .map((c) => String((c.candidatePayload as Record<string, unknown>).species_catalog_code ?? "").toLowerCase())
    .filter(Boolean);
  assert.ok(codes.some((c) => EDIBLE_CATALOG_CODES.has(c)), `expected edible code among open; got ${codes.join(",")}`);
}

export function assertBudgetSanity(res: RecommendationGenerateResponse, budgetInr: number): void {
  for (const c of openCandidates(res)) {
    const est = Number((c.candidatePayload as Record<string, unknown>).estimated_install_cost_inr ?? 0);
    assert.ok(
      est <= budgetInr * 1.3,
      `install ${est} exceeds relaxed budget cap for ${budgetInr}`,
    );
  }
}

export function assertLayoutEligibility(scenario: RecommendationTestScenario): void {
  if (!scenario.expect.layoutEligible) return;
  const le = getLayoutEligibility(scenario.request);
  assert.equal(le.eligible, true, `layout should be eligible: ${le.ineligibleReason ?? "ok"}`);
}

export function assertRankingSanity(res: RecommendationGenerateResponse): void {
  const open = openCandidates(res);
  if (open.length < 2) return;
  for (let i = 0; i < open.length - 1; i++) {
    const a = Number(open[i]!.scores.blended);
    const b = Number(open[i + 1]!.scores.blended);
    assert.ok(a >= b - 1e-6, "open candidates should be sorted by blended desc");
  }
}

export function assertOpenAvoidSprinklerMistInScarceWater(res: RecommendationGenerateResponse): void {
  for (const c of openCandidates(res)) {
    const irr = String((c.candidatePayload as Record<string, unknown>).irrigation_type ?? "").toLowerCase();
    assert.ok(
      irr !== "sprinkler" && irr !== "mist",
      `open candidate should not use sprinkler/mist under scarce water (got ${irr})`,
    );
  }
}

export function assertForbiddenOpenCatalogCodes(res: RecommendationGenerateResponse, codes: string[]): void {
  const forbid = new Set(codes.map((c) => c.toLowerCase()));
  for (const c of openCandidates(res)) {
    const code = String((c.candidatePayload as Record<string, unknown>).species_catalog_code ?? "").toLowerCase();
    assert.ok(!forbid.has(code), `open candidate should not include ${code} for this scenario`);
  }
}

export function assertAtLeastOneOpenCodeFrom(res: RecommendationGenerateResponse, codes: string[]): void {
  const want = new Set(codes.map((c) => c.toLowerCase()));
  const got = openCandidates(res).map((c) =>
    String((c.candidatePayload as Record<string, unknown>).species_catalog_code ?? "").toLowerCase(),
  );
  assert.ok(
    got.some((x) => want.has(x)),
    `expected one of [${[...want].join(", ")}] among open candidates; got: ${got.join(", ")}`,
  );
}

export function assertAtLeastOneOpenCodeFromInTop(
  res: RecommendationGenerateResponse,
  topN: number,
  codes: string[],
): void {
  const want = new Set(codes.map((c) => c.toLowerCase()));
  const got = openCandidates(res)
    .slice(0, topN)
    .map((c) => String((c.candidatePayload as Record<string, unknown>).species_catalog_code ?? "").toLowerCase());
  assert.ok(
    got.some((x) => want.has(x)),
    `expected one of [${[...want].join(", ")}] in top ${topN} open; got: ${got.join(", ")}`,
  );
}

export function assertEdibleDominanceInTopOpen(res: RecommendationGenerateResponse, k: number, minEdible: number): void {
  const top = openCandidates(res).slice(0, k);
  const edibleCodes = top.filter((c) =>
    EDIBLE_CATALOG_CODES.has(
      String((c.candidatePayload as Record<string, unknown>).species_catalog_code ?? "").toLowerCase(),
    ),
  );
  assert.ok(
    edibleCodes.length >= minEdible,
    `expected >=${minEdible} edible in top ${k} open, got ${edibleCodes.length}`,
  );
}

export function assertForbiddenCodesInTopOpen(
  res: RecommendationGenerateResponse,
  topN: number,
  forbiddenCodes: string[],
): void {
  const forbid = new Set(forbiddenCodes.map((c) => c.toLowerCase()));
  const top = openCandidates(res).slice(0, topN);
  for (const c of top) {
    const code = String((c.candidatePayload as Record<string, unknown>).species_catalog_code ?? "").toLowerCase();
    assert.ok(!forbid.has(code), `top-${topN} open should not include ${code}`);
  }
}
