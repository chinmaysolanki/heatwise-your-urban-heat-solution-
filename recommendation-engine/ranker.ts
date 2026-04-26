// ============================================================
// HeatWise — Ranker & Explanation Generator
// src/engine/ranker.ts
//
// Responsibility: sort scored candidates, select the top N,
// and generate a structured Explanation for each one that
// tells the user *why* this layout was recommended.
//
// The explanations reference actual score values and input
// conditions — they are generated deterministically from
// the data, not from an LLM (though an LLM can enrich them).
// ============================================================

import type {
  Candidate,
  ProjectInput,
  Recommendation,
  Explanation,
  ScoreFactor,
} from "@/models";

// ─── Public API ──────────────────────────────────────────────

/**
 * Sorts candidates by composite score, selects the top N,
 * and returns full Recommendation objects (without layout
 * schema — that is attached by the pipeline after this step).
 */
export function rankAndExplain(
  candidates: Candidate[],
  input:      ProjectInput,
  topN = 3,
): Recommendation[] {
  // Sort descending by total score, tie-break by cooling
  const sorted = [...candidates].sort((a, b) => {
    const scoreDiff = b.score.total - a.score.total;
    if (scoreDiff !== 0) return scoreDiff;
    return b.heatEstimate.valueC - a.heatEstimate.valueC;
  });

  const top = sorted.slice(0, topN);

  return top.map((candidate, index) => ({
    rank:         index + 1,
    candidate,
    explanation:  buildExplanation(candidate, index + 1, input, sorted),
    layoutSchema: null as any, // populated by layoutSchemaGenerator
  }));
}

// ─── Explanation Builder ──────────────────────────────────────

function buildExplanation(
  candidate: Candidate,
  rank:      number,
  input:     ProjectInput,
  allSorted: Candidate[],
): Explanation {
  const { template, heatEstimate, costEstimate, score } = candidate;

  return {
    headline:     buildHeadline(rank, candidate, input),
    summary:      buildSummary(candidate, input),
    scoreFactors: buildScoreFactors(candidate, input),
    tradeoffs:    buildTradeoffs(candidate, input),
    whyNotOthers: rank === 1
      ? buildWhyNotOthers(candidate, allSorted.slice(1, 3))
      : undefined,
  };
}

// ─── Headline ─────────────────────────────────────────────────

function buildHeadline(
  rank:      number,
  candidate: Candidate,
  input:     ProjectInput,
): string {
  const { score, heatEstimate, template } = candidate;

  if (rank === 1) {
    // Pick the headline based on the highest-scoring dimension
    const dims = [
      { label: "Best for Cooling",     value: score.coolingEfficiency },
      { label: "Best Value",           value: score.costFit           },
      { label: "Easiest to Maintain",  value: score.maintenanceFit    },
      { label: "Best Goal Match",      value: score.goalAlignment     },
    ];
    const topDim = dims.reduce((a, b) => (a.value >= b.value ? a : b));

    // Override with goal-specific if aligned
    if (input.primaryGoal === "cooling" && score.coolingEfficiency >= 75)
      return "Best for Cooling Impact";
    if (input.primaryGoal === "food" && score.goalAlignment >= 80)
      return "Best for Growing Food";
    if (input.primaryGoal === "aesthetic" && score.goalAlignment >= 80)
      return "Best Visual Impact";

    return topDim.label;
  }

  if (rank === 2) {
    if (score.costFit > score.coolingEfficiency) return "Best Budget Option";
    if (score.maintenanceFit >= 90)              return "Lowest Maintenance";
    return "Strong Runner-Up";
  }

  // rank === 3
  if (template.type === "container")  return "Most Flexible Option";
  if (template.type === "vertical")   return "Best for Small Spaces";
  if (template.type === "modular")    return "Most Scalable Layout";
  return "Alternative Approach";
}

// ─── Summary Prose ────────────────────────────────────────────

function buildSummary(
  candidate: Candidate,
  input:     ProjectInput,
): string {
  const { template, heatEstimate, costEstimate, scoredPlants } = candidate;
  const topPlant = scoredPlants[0]?.plant.name ?? "selected plants";
  const costRange = `$${costEstimate.totalMin.toLocaleString()}–$${costEstimate.totalMax.toLocaleString()}`;

  const sentences: string[] = [];

  // Sentence 1: What the layout is and why it was picked
  sentences.push(
    `A${template.type === "intensive" ? "n" : ""} ${template.type} layout — ${template.name} — ` +
    `was selected as the strongest match for your ${input.spaceType} ` +
    `(${input.widthM}×${input.lengthM}m, ${input.sunExposure} sun, ${input.budgetRange} budget).`
  );

  // Sentence 2: Cooling and cost outcome
  sentences.push(
    `Expected to reduce ambient temperature by ` +
    `${heatEstimate.minC}–${heatEstimate.maxC}°C ` +
    `(${heatEstimate.confidence} confidence), ` +
    `with an estimated installation cost of ${costRange}.`
  );

  // Sentence 3: Key plant + ROI note
  if (costEstimate.roiMonths < 120) {
    sentences.push(
      `${topPlant} leads the plant selection for this layout; ` +
      `energy bill savings cover the installation cost in approximately ` +
      `${Math.ceil(costEstimate.roiMonths / 12)} year${costEstimate.roiMonths > 24 ? "s" : ""}.`
    );
  } else {
    sentences.push(
      `${topPlant} leads the plant selection; ` +
      `this layout prioritises ${template.eligibleGoals[0]} over financial return.`
    );
  }

  return sentences.join(" ");
}

// ─── Score Factors ────────────────────────────────────────────

function buildScoreFactors(
  candidate: Candidate,
  input:     ProjectInput,
): ScoreFactor[] {
  const { score, heatEstimate, costEstimate, template } = candidate;
  const factors: ScoreFactor[] = [];

  // Cooling efficiency factor
  factors.push({
    label:  `Cooling Efficiency: ${score.coolingEfficiency}/100`,
    impact: score.coolingEfficiency >= 65 ? "positive"
          : score.coolingEfficiency >= 40 ? "neutral" : "negative",
    detail: `Estimated ${heatEstimate.valueC}°C reduction (${heatEstimate.confidence} confidence). ` +
            `${heatEstimate.factors[0] ?? ""}`,
  });

  // Cost fit factor
  factors.push({
    label:  `Cost Fit: ${score.costFit}/100`,
    impact: score.costFit >= 65 ? "positive"
          : score.costFit >= 40 ? "neutral" : "negative",
    detail: `Installation $${costEstimate.totalMin.toLocaleString()}–` +
            `$${costEstimate.totalMax.toLocaleString()} ` +
            `(ROI ~${costEstimate.roiMonths <= 999 ? costEstimate.roiMonths + " months" : "long-term"}).`,
  });

  // Maintenance fit factor
  factors.push({
    label:  `Maintenance Fit: ${score.maintenanceFit}/100`,
    impact: score.maintenanceFit >= 75 ? "positive"
          : score.maintenanceFit >= 50 ? "neutral" : "negative",
    detail: `Template designed for "${template.eligibleMaint.join("/")}"; ` +
            `you selected "${input.maintenanceLevel}" — ` +
            (score.maintenanceFit >= 75 ? "well matched." : "slightly over-demanding."),
  });

  // Goal alignment factor
  factors.push({
    label:  `Goal Alignment: ${score.goalAlignment}/100`,
    impact: score.goalAlignment >= 70 ? "positive"
          : score.goalAlignment >= 50 ? "neutral" : "negative",
    detail: `Your goal is "${input.primaryGoal}"; this template targets [${template.eligibleGoals.join(", ")}].`,
  });

  // Surface any notable bonuses
  const topBonuses = candidate.score.bonuses.slice(0, 2);
  for (const bonus of topBonuses) {
    factors.push({
      label:  `Bonus: +${bonus.points}pts`,
      impact: "positive",
      detail: bonus.reason,
    });
  }

  // Surface any notable penalties
  const topPenalties = candidate.score.penalties.slice(0, 2);
  for (const penalty of topPenalties) {
    factors.push({
      label:  `Note: −${penalty.points}pts`,
      impact: "negative",
      detail: penalty.reason,
    });
  }

  return factors;
}

// ─── Tradeoffs ────────────────────────────────────────────────

function buildTradeoffs(
  candidate: Candidate,
  input:     ProjectInput,
): string[] {
  const tradeoffs: string[] = [];
  const { template, costEstimate, heatEstimate } = candidate;

  if (template.requiresStructural) {
    tradeoffs.push("Requires a structural engineer sign-off before installation.");
  }

  if (template.requiresWater) {
    tradeoffs.push("Needs a permanent water connection — install cost includes plumbing.");
  }

  if (heatEstimate.confidence === "low") {
    tradeoffs.push("Heat reduction estimate has low confidence due to small space size.");
  }

  if (costEstimate.roiMonths > 84) {
    tradeoffs.push("Financial ROI is long-term (7+ years) — value is mainly environmental and quality-of-life.");
  }

  if (input.maintenanceLevel === "minimal" && template.eligibleMaint.includes("active")) {
    tradeoffs.push("Some modules in this layout benefit from occasional attention despite low maintenance rating.");
  }

  if (candidate.scoredPlants.length < 3) {
    tradeoffs.push("Limited plant species available for these conditions — diversity will be modest.");
  }

  if (template.type === "intensive") {
    tradeoffs.push("Intensive systems take 1–2 growing seasons to reach full cooling performance.");
  }

  if (tradeoffs.length === 0) {
    tradeoffs.push("No significant tradeoffs identified for this input combination.");
  }

  return tradeoffs;
}

// ─── Why Not Others ───────────────────────────────────────────

function buildWhyNotOthers(
  winner:   Candidate,
  runners:  Candidate[],
): string[] {
  return runners.map((runner) => {
    const scoreDiff = winner.score.total - runner.score.total;
    const heatDiff  = winner.heatEstimate.valueC - runner.heatEstimate.valueC;

    if (heatDiff > 0.5) {
      return `"${runner.template.name}" was outscored — ${heatDiff.toFixed(1)}°C less cooling ` +
             `(${runner.score.total} vs ${winner.score.total} total score).`;
    }
    if (runner.costEstimate.totalMin > winner.costEstimate.totalMin * 1.3) {
      return `"${runner.template.name}" costs more without proportional cooling benefit.`;
    }
    return `"${runner.template.name}" scored ${scoreDiff} points lower overall (${runner.score.total}/100).`;
  });
}
