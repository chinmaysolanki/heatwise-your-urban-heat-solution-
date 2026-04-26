// ============================================================
// HeatWise — Multi-Criteria Scoring Engine
// src/engine/scorer.ts
//
// Responsibility: assign a 0–100 composite score to each
// valid candidate based on four independently weighted
// criteria. Every score decision is traceable via bonuses
// and penalties logged on the ScoreBreakdown.
//
// Scoring is fully deterministic — same input always
// produces the same scores.
// ============================================================

import type {
  Candidate,
  ProjectInput,
  SpaceGeometry,
  ScoreBreakdown,
  ScoringWeights,
  ScoringBonus,
  ScoringPenalty,
} from "@/models";

// ─── Default Weights ─────────────────────────────────────────
//
// Weights are exposed so callers can pass custom weights
// (e.g. a "budget-first" user profile). Must sum to 1.0.

export const DEFAULT_WEIGHTS: ScoringWeights = {
  coolingEfficiency: 0.35,
  costFit:           0.25,
  maintenanceFit:    0.20,
  goalAlignment:     0.20,
};

// ─── Public API ──────────────────────────────────────────────

/**
 * Computes and attaches a ScoreBreakdown to every candidate.
 * Mutates candidates in-place (score field) and returns them.
 * Using mutation avoids cloning large objects repeatedly.
 */
export function scoreCandidates(
  candidates: Candidate[],
  input:      ProjectInput,
  geometry:   SpaceGeometry,
  weights:    ScoringWeights = DEFAULT_WEIGHTS,
): Candidate[] {
  // We need relative context for cost scoring —
  // normalise costs across the candidate pool first.
  const costContext = buildCostContext(candidates);

  for (const candidate of candidates) {
    candidate.score = computeScore(
      candidate, input, geometry, weights, costContext,
    );
  }

  return candidates;
}

// ─── Context for Relative Scoring ────────────────────────────

interface CostContext {
  minTotal: number;
  maxTotal: number;
  range:    number;
}

function buildCostContext(candidates: Candidate[]): CostContext {
  const totals = candidates.map((c) => c.costEstimate.totalMin);
  const min    = Math.min(...totals);
  const max    = Math.max(...totals);
  return { minTotal: min, maxTotal: max, range: max - min || 1 };
}

// ─── Score Computation ───────────────────────────────────────

function computeScore(
  candidate:   Candidate,
  input:       ProjectInput,
  geometry:    SpaceGeometry,
  weights:     ScoringWeights,
  costContext: CostContext,
): ScoreBreakdown {
  const bonuses:   ScoringBonus[]   = [];
  const penalties: ScoringPenalty[] = [];

  // ── Dimension 1: Cooling Efficiency ─────────────────────
  //    Measures: how much temperature reduction does this
  //    layout deliver relative to the best possible outcome
  //    for this space type.
  const maxTheoreticalC = getMaxTheoreticalHeat(input.spaceType);
  let coolingRaw = Math.min(
    100,
    (candidate.heatEstimate.valueC / maxTheoreticalC) * 100,
  );

  // Bonus: high-confidence estimate is worth more
  if (candidate.heatEstimate.confidence === "high") {
    bonuses.push({ reason: "High-confidence heat estimate", points: 6 });
    coolingRaw = Math.min(100, coolingRaw + 6);
  }

  // Bonus: layout uses evaporative cooling (irrigation)
  const hasIrrigation = candidate.resolvedModules.some(
    (m) => m.type === "irrigation",
  );
  if (hasIrrigation && input.waterAccess) {
    bonuses.push({ reason: "Irrigation adds evaporative cooling", points: 5 });
    coolingRaw = Math.min(100, coolingRaw + 5);
  }

  // Penalty: very low cooling for user who prioritises it
  if (input.primaryGoal === "cooling" && candidate.heatEstimate.valueC < 1.0) {
    penalties.push({ reason: "Low cooling impact for cooling-focused goal", points: 15 });
    coolingRaw = Math.max(0, coolingRaw - 15);
  }

  const coolingEfficiency = Math.round(coolingRaw);

  // ── Dimension 2: Cost Fit ────────────────────────────────
  //    Measures: how well the layout cost aligns with the
  //    user's stated budget appetite.
  let costRaw = scoreCostFit(candidate, input, costContext);

  // Bonus: strong ROI
  if (candidate.costEstimate.roiMonths <= 36) {
    bonuses.push({ reason: "ROI under 3 years", points: 8 });
    costRaw = Math.min(100, costRaw + 8);
  } else if (candidate.costEstimate.roiMonths <= 60) {
    bonuses.push({ reason: "ROI under 5 years", points: 4 });
    costRaw = Math.min(100, costRaw + 4);
  }

  // Penalty: over budget for low-budget users
  const overBudgetThresholds: Record<string, number> = {
    low: 500, medium: 2000, high: 6000, premium: 99999,
  };
  if (candidate.costEstimate.totalMin > overBudgetThresholds[input.budgetRange]) {
    const overage = candidate.costEstimate.totalMin - overBudgetThresholds[input.budgetRange];
    const overagePct = overage / overBudgetThresholds[input.budgetRange];
    const penaltyPts = Math.min(30, Math.round(overagePct * 20));
    if (penaltyPts > 0) {
      penalties.push({ reason: `Budget overrun by ~${Math.round(overagePct * 100)}%`, points: penaltyPts });
      costRaw = Math.max(0, costRaw - penaltyPts);
    }
  }

  const costFit = Math.round(Math.max(0, costRaw));

  // ── Dimension 3: Maintenance Fit ────────────────────────
  //    Measures: how well the template's maintenance demand
  //    matches what the user is willing to commit to.
  const MAINT_ORDER: Record<string, number> = {
    minimal: 1, moderate: 2, active: 3,
  };
  const templateMaxMaint = Math.max(
    ...candidate.template.eligibleMaint.map((m) => MAINT_ORDER[m]),
  );
  const userMaint = MAINT_ORDER[input.maintenanceLevel];

  let maintRaw: number;
  if (userMaint >= templateMaxMaint) {
    // User is willing to do more than required — perfect fit
    maintRaw = 90 + (userMaint - templateMaxMaint) * 5;
  } else {
    // This shouldn't happen after filtering, but score low defensively
    maintRaw = 20;
  }

  // Bonus: minimal maintenance template for minimal user
  if (input.maintenanceLevel === "minimal" &&
      candidate.template.eligibleMaint.includes("minimal")) {
    bonuses.push({ reason: "Low-maintenance layout matches preference", points: 8 });
    maintRaw = Math.min(100, maintRaw + 8);
  }

  // Penalty: high-maintenance layout for minimal user
  if (input.maintenanceLevel === "minimal" &&
      !candidate.template.eligibleMaint.includes("minimal")) {
    penalties.push({ reason: "Template requires more upkeep than preferred", points: 10 });
    maintRaw = Math.max(0, maintRaw - 10);
  }

  const maintenanceFit = Math.round(Math.min(100, maintRaw));

  // ── Dimension 4: Goal Alignment ──────────────────────────
  //    Measures: how specifically the template addresses the
  //    user's primary goal.
  let goalRaw = scoreGoalAlignment(candidate, input);

  // Bonus: strong plant match for the goal
  const goalPlantScore = candidate.scoredPlants.slice(0, 5).reduce(
    (sum, sp) => sum + sp.relevanceScore, 0,
  ) / 5;
  if (goalPlantScore > 70) {
    bonuses.push({ reason: "Plant selection strongly aligned to goal", points: 8 });
    goalRaw = Math.min(100, goalRaw + 8);
  }

  // Bonus: food garden goal + food-capable layout
  if (input.primaryGoal === "food" &&
      candidate.template.plantTypes.some(t => t === "vegetable" || t === "herb")) {
    bonuses.push({ reason: "Layout supports food production", points: 12 });
    goalRaw = Math.min(100, goalRaw + 12);
  }

  const goalAlignment = Math.round(Math.min(100, goalRaw));

  // ── Composite Score ──────────────────────────────────────
  const total = Math.round(
    coolingEfficiency * weights.coolingEfficiency +
    costFit           * weights.costFit           +
    maintenanceFit    * weights.maintenanceFit     +
    goalAlignment     * weights.goalAlignment
  );

  return {
    coolingEfficiency,
    costFit,
    maintenanceFit,
    goalAlignment,
    bonuses,
    penalties,
    total: Math.min(100, total),
  };
}

// ─── Scoring Helpers ─────────────────────────────────────────

/** Maximum achievable cooling for a space type (benchmark) */
function getMaxTheoreticalHeat(spaceType: string): number {
  const maxes: Record<string, number> = {
    rooftop: 7.0,   // intensive green roof in full sun
    terrace: 5.5,   // pergola + climbing plants
    balcony: 2.5,   // living wall
  };
  return maxes[spaceType] ?? 5.0;
}

/** Budget fit: how well cost matches budget appetite */
function scoreCostFit(
  candidate:   Candidate,
  input:       ProjectInput,
  costContext: CostContext,
): number {
  // Budget sweet spots (target mid-point cost by range)
  const BUDGET_TARGETS: Record<string, number> = {
    low:     400,
    medium:  1800,
    high:    5000,
    premium: 12000,
  };

  const target  = BUDGET_TARGETS[input.budgetRange] ?? 2000;
  const actual  = candidate.costEstimate.totalMin;
  const diff    = Math.abs(actual - target);
  const diffPct = diff / target;

  // Score decreases with distance from the sweet spot
  if (diffPct <= 0.15) return 95;
  if (diffPct <= 0.30) return 80;
  if (diffPct <= 0.50) return 60;
  if (diffPct <= 0.80) return 40;
  return 20;
}

/** Goal alignment: template eligibility + direct goal match */
function scoreGoalAlignment(
  candidate: Candidate,
  input:     ProjectInput,
): number {
  const t = candidate.template;

  // Direct goal match (template includes the goal)
  if (t.eligibleGoals.includes(input.primaryGoal)) {
    // Is it the primary focus of the template?
    const isPrimary = t.eligibleGoals[0] === input.primaryGoal;
    return isPrimary ? 90 : 70;
  }

  // Partial match via "mixed" — gives broad compatibility
  if (t.eligibleGoals.includes("mixed")) return 55;

  // No match (should have been filtered, but score low defensively)
  return 20;
}
