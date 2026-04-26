import type { RuntimeCandidate, RecommendationGenerateResponse } from "@/lib/ml/recommendationRuntimeTypes";
import type {
  CandidatePricingBlock,
  CostRangeInr,
  EstimateConfidenceBand,
  PricingContextInput,
} from "@/lib/ml/pricingTypes";
import { PRICING_RULES_VERSION } from "@/lib/ml/pricingTypes";
import { db } from "@/lib/db";
import { assessBudgetFit } from "@/lib/services/budgetFitService";
import {
  cheaperAlternativesList,
  finalizeExplanationJson,
  majorCostDriversList,
  volatilityNoteText,
} from "@/lib/services/pricingExplanationService";
import {
  resolveClimateZone,
  resolveProjectType,
  resolveSupplyRegion,
} from "@/lib/services/recommendationConstraintService";
import { medianQuotedAmountForRegion } from "@/lib/services/quoteComparisonService";

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Heuristic: values > 300 treated as sqft → sqm. */
export function areaSqmFromProject(project: Record<string, unknown>): number {
  const a = num(project.area ?? project.area_sqm, 40);
  if (a <= 0) return 40;
  if (a > 300) return a / 10.764;
  return a;
}

function greeneryMult(g: string): number {
  const x = g.toLowerCase();
  if (x === "low") return 0.88;
  if (x === "high") return 1.14;
  return 1;
}

function irrigationMult(i: string): number {
  const x = i.toLowerCase();
  if (x === "manual") return 0.94;
  if (x === "drip" || x === "automatic") return 1.1;
  return 1;
}

function planterMult(p: string): number {
  const x = p.toLowerCase();
  if (x === "container") return 0.9;
  if (x === "raised") return 1.04;
  return 1;
}

function shadeMult(s: string): number {
  const x = s.toLowerCase();
  if (x === "none" || !x) return 0.93;
  if (x === "shade_sail") return 1.05;
  if (x === "pergola") return 1.26;
  if (x === "green_wall_segment") return 1.34;
  return 1.02;
}

function loadMult(project: Record<string, unknown>): number {
  const l = String(project.load_capacity_level ?? "medium").toLowerCase();
  if (l === "low") return 0.96;
  if (l === "high") return 1.07;
  return 1;
}

function premiumMult(preferences: Record<string, unknown>): number {
  const purpose = String(preferences.purpose_primary ?? "").toLowerCase();
  const tier = String(preferences.aesthetic_tier ?? preferences.budget_tier ?? "").toLowerCase();
  let m = 1;
  if (purpose.includes("privacy")) m *= 1.06;
  if (tier === "premium") m *= 1.1;
  if (tier === "economy") m *= 0.94;
  return m;
}

function cityTierMult(ctx: PricingContextInput["evaluationContext"]): number {
  const t = String(ctx?.cityTier ?? "").toLowerCase();
  if (t.includes("1") || t === "tier1" || t === "metro") return 1.08;
  if (t.includes("3") || t === "tier3") return 0.96;
  return 1.02;
}

export async function estimateCandidatePricing(
  candidatePayload: Record<string, unknown>,
  ctx: PricingContextInput,
  options?: { benchmarkMedianInr?: number | null },
): Promise<CandidatePricingBlock> {
  const project = ctx.project;
  const preferences = ctx.preferences;
  const supply = ctx.supplyConstraints;
  const sqm = areaSqmFromProject(project);
  const ptype = resolveProjectType(project).toLowerCase();
  const region = resolveSupplyRegion(project, ctx.environment, ctx.evaluationContext as never) ?? "unknown";
  const climateZone = resolveClimateZone(ctx.environment, ctx.evaluationContext as never);

  const rate =
    ptype.includes("balcony") || sqm < 14 ? 2400 : ptype.includes("terrace") ? 4300 : 3600;

  let median =
    rate * Math.pow(Math.max(sqm, 5.5), 0.82) *
    greeneryMult(String(candidatePayload.greenery_density ?? "medium")) *
    irrigationMult(String(candidatePayload.irrigation_type ?? "manual")) *
    planterMult(String(candidatePayload.planter_type ?? "container")) *
    shadeMult(String(candidatePayload.shade_solution ?? "none")) *
    loadMult(project) *
    premiumMult(preferences) *
    cityTierMult(ctx.evaluationContext ?? null);

  const floor = ptype.includes("balcony") || sqm < 12 ? 16_000 : 28_000;
  median = Math.max(floor, median);

  if (options?.benchmarkMedianInr && options.benchmarkMedianInr > 0) {
    const blend = 0.72 * median + 0.28 * options.benchmarkMedianInr;
    median = blend;
  }

  let bandLo = 0.78;
  let bandHi = 1.26;
  let volatility = 0.22;
  let contingency: number | null = 5;
  const opRisk = supply?.readiness?.operationalRiskLevel;
  if (opRisk === "high") {
    bandLo -= 0.06;
    bandHi += 0.14;
    volatility += 0.22;
    contingency = 10;
  } else if (opRisk === "medium") {
    bandHi += 0.06;
    volatility += 0.1;
    contingency = 7;
  }

  if (supply?.deferInstallSuggested) {
    volatility += 0.08;
  }

  volatility = Math.min(0.92, volatility);
  const minI = median * bandLo;
  const maxI = median * bandHi;

  const maintBase = 0.12 + (irrigationMult(String(candidatePayload.irrigation_type ?? "")) - 1) * 0.04;
  const maintMed = median * maintBase;
  const maint: CostRangeInr = {
    min: maintMed * 0.75,
    median: maintMed,
    max: maintMed * 1.35,
  };

  const mat = median * 0.42;
  const lab = median * 0.33;
  const irrig = median * 0.09;
  const shadeC = median * 0.11;
  const logi = median * 0.05;

  let confidence: EstimateConfidenceBand = "medium";
  if (volatility < 0.28 && opRisk === "low") confidence = "tight";
  else if (volatility > 0.52 || opRisk === "high") confidence = "very_wide";
  else if (volatility > 0.36) confidence = "wide";

  const estimateSource =
    options?.benchmarkMedianInr != null && options.benchmarkMedianInr > 0 ? "installer_benchmark" : supply
      ? "hybrid"
      : "rules";

  const fromProject = num(project.budget_inr, NaN);
  const fromPref = num(preferences.budget_inr, NaN);
  const userBudget =
    ctx.userBudgetInr ??
    (Number.isFinite(fromProject) && fromProject > 0
      ? fromProject
      : Number.isFinite(fromPref) && fromPref > 0
        ? fromPref
        : null);

  const installRange: CostRangeInr = { min: minI, median, max: maxI };

  let budgetFit = null as ReturnType<typeof assessBudgetFit> | null;
  let budgetFitScore: number | null = null;
  let affordabilityRisk: CandidatePricingBlock["affordabilityRiskLevel"] = "low";
  let budgetFitReason: string | null = null;
  let phasedJson: string | null = null;

  if (userBudget != null && Number.isFinite(userBudget) && userBudget > 0) {
    budgetFit = assessBudgetFit({
      userBudgetInr: userBudget,
      installRange,
      estimateConfidenceBand: confidence,
      candidate: candidatePayload,
    });
    budgetFitScore = budgetFit.budgetFitScore;
    affordabilityRisk = budgetFit.affordabilityRiskLevel;
    budgetFitReason = budgetFit.budgetFitReason;
    phasedJson = budgetFit.phasedInstallOptionJson;
  }

  const shadeSol = String(candidatePayload.shade_solution ?? "none");
  const irr = String(candidatePayload.irrigation_type ?? "manual");
  const planter = String(candidatePayload.planter_type ?? "container");
  const green = String(candidatePayload.greenery_density ?? "medium");

  const drivers = majorCostDriversList({
    shadeSolution: shadeSol,
    irrigationType: irr,
    greeneryDensity: green,
    planterType: planter,
    areaSqm: sqm,
    projectType: ptype,
  });
  const alts = cheaperAlternativesList({ shadeSolution: shadeSol, irrigationType: irr, planterType: planter });

  const block: CandidatePricingBlock = {
    installCostRange: installRange,
    annualMaintenanceRange: maint,
    medianCostEstimate: median,
    estimateConfidenceBand: confidence,
    budgetFitScore,
    affordabilityRiskLevel: affordabilityRisk,
    quoteVolatilityScore: volatility,
    volatilityNote: volatilityNoteText(volatility, contingency),
    majorCostDrivers: drivers,
    costReductionAlternatives: alts,
    phaseableRecommendation: phasedJson != null,
    estimateSource,
    pricingRulesVersion: PRICING_RULES_VERSION,
    contingencyPct: contingency,
    materialCostComponentInr: mat,
    laborCostComponentInr: lab,
    irrigationCostComponentInr: irrig,
    shadeSystemCostComponentInr: shadeC,
    logisticsCostComponentInr: logi,
    majorCostDriversJson: "[]",
    uncertaintyReasonsJson: "[]",
    budgetFitReason,
    cheaperAlternativesJson: "[]",
    phasedInstallOptionJson: phasedJson,
    quoteAlignmentNote: null,
    predictedVsActualNote: null,
  };

  return finalizeExplanationJson(block, { supplyOperationalRisk: opRisk ?? null });
}

export async function enrichRecommendationsWithPricing(
  out: RecommendationGenerateResponse,
  ctx: PricingContextInput,
): Promise<RecommendationGenerateResponse> {
  const useBench = process.env.HEATWISE_PRICING_USE_QUOTE_BENCHMARK === "1";
  const region = resolveSupplyRegion(ctx.project, ctx.environment, ctx.evaluationContext as never);
  let bench: number | null = null;
  if (useBench && region) {
    try {
      bench = await medianQuotedAmountForRegion(region);
    } catch {
      bench = null;
    }
  }

  const candidates: RuntimeCandidate[] = [];
  for (const c of out.candidates) {
    const payload = (c.candidatePayload ?? {}) as Record<string, unknown>;
    const pricing = await estimateCandidatePricing(payload, ctx, { benchmarkMedianInr: bench });
    candidates.push({
      ...c,
      pricing,
    });
  }

  return {
    ...out,
    candidates,
    pricingIntelligenceMeta: {
      pricingRulesVersion: PRICING_RULES_VERSION,
      enrichedCandidateCount: candidates.length,
      region: region ?? null,
      climateZone: resolveClimateZone(ctx.environment, ctx.evaluationContext as never),
    },
  };
}

export async function persistCostEstimateSnapshot(input: {
  projectId?: string | null;
  recommendationSessionId?: string | null;
  candidateSnapshotId?: string | null;
  block: CandidatePricingBlock;
  solutionType: string;
  region: string;
  climateZone: string;
  projectType: string;
  pricingModelVersion?: string | null;
}) {
  const b = input.block;
  return db.costEstimateSnapshot.create({
    data: {
      projectId: input.projectId ?? undefined,
      recommendationSessionId: input.recommendationSessionId ?? undefined,
      candidateSnapshotId: input.candidateSnapshotId ?? undefined,
      pricingModelVersion: input.pricingModelVersion ?? undefined,
      pricingRulesVersion: b.pricingRulesVersion,
      region: input.region,
      climateZone: input.climateZone,
      projectType: input.projectType,
      solutionType: input.solutionType,
      estimateSource: b.estimateSource,
      estimatedInstallCostMinInr: b.installCostRange.min,
      estimatedInstallCostMedianInr: b.installCostRange.median,
      estimatedInstallCostMaxInr: b.installCostRange.max,
      estimatedAnnualMaintenanceMinInr: b.annualMaintenanceRange.min,
      estimatedAnnualMaintenanceMedianInr: b.annualMaintenanceRange.median,
      estimatedAnnualMaintenanceMaxInr: b.annualMaintenanceRange.max,
      materialCostComponentInr: b.materialCostComponentInr ?? undefined,
      laborCostComponentInr: b.laborCostComponentInr ?? undefined,
      irrigationCostComponentInr: b.irrigationCostComponentInr ?? undefined,
      shadeSystemCostComponentInr: b.shadeSystemCostComponentInr ?? undefined,
      logisticsCostComponentInr: b.logisticsCostComponentInr ?? undefined,
      contingencyPct: b.contingencyPct ?? undefined,
      estimateConfidenceBand: b.estimateConfidenceBand,
      quoteVolatilityScore: b.quoteVolatilityScore,
      budgetFitScore: b.budgetFitScore ?? undefined,
      majorCostDriversJson: b.majorCostDriversJson,
      uncertaintyReasonsJson: b.uncertaintyReasonsJson,
      cheaperAlternativesJson: b.cheaperAlternativesJson,
      phasedInstallOptionJson: b.phasedInstallOptionJson ?? undefined,
      metadataJson: JSON.stringify({ pricingRulesVersion: b.pricingRulesVersion }),
    },
  });
}
