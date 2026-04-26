import type { Prisma } from "@prisma/client";

import type {
  BudgetFitBand,
  BudgetFitResult,
  CostRangeInr,
  EstimateConfidenceBand,
} from "@/lib/ml/pricingTypes";
import { db } from "@/lib/db";
import { cheaperAlternativesList, phasedInstallHint } from "@/lib/services/pricingExplanationService";

export function assessBudgetFit(input: {
  userBudgetInr: number;
  installRange: CostRangeInr;
  estimateConfidenceBand: EstimateConfidenceBand;
  candidate: Record<string, unknown>;
}): BudgetFitResult {
  const budget = Math.max(0, input.userBudgetInr);
  const med = input.installRange.median;
  const max = input.installRange.max;

  let band: BudgetFitBand;
  let score: number;
  let stretch = false;
  let risk: "low" | "medium" | "high" = "low";
  let reason: string;

  if (input.estimateConfidenceBand === "very_wide") {
    band = "high_uncertainty";
    score = 0.45;
    stretch = max > budget * 1.05;
    risk = "high";
    reason =
      "High estimate uncertainty — treat budget comparison as indicative until a site visit and quotes arrive.";
  } else if (med > budget * 1.08) {
    band = "over_budget";
    score = Math.max(0, 1 - (med - budget) / Math.max(budget, 1));
    stretch = false;
    risk = "high";
    reason = "Typical install cost for this card is above your stated budget.";
  } else if (max > budget && med <= budget * 1.02) {
    band = "stretch_required";
    score = 0.55;
    stretch = true;
    risk = "medium";
    reason = "Median estimate fits, but upper band exceeds budget — scope or contingency may be needed.";
  } else if (max > budget * 0.92 && max <= budget * 1.01) {
    band = "near_budget_limit";
    score = 0.72;
    stretch = false;
    risk = "medium";
    reason = "Within budget but close to upper estimate — confirm with quotes.";
  } else if (max <= budget * 0.85) {
    band = "comfortably_within_budget";
    score = 0.92;
    stretch = false;
    risk = "low";
    reason = "Upper estimate sits comfortably under your budget.";
  } else {
    band = "comfortably_within_budget";
    score = 0.85;
    stretch = false;
    risk = "low";
    reason = "This setup appears affordable against your budget, with modest headroom.";
  }

  const shade = String(input.candidate.shade_solution ?? "none");
  const irr = String(input.candidate.irrigation_type ?? "manual");
  const planter = String(input.candidate.planter_type ?? "container");
  const alts = cheaperAlternativesList({ shadeSolution: shade, irrigationType: irr, planterType: planter });
  const phased = phasedInstallHint(band === "over_budget", stretch);

  return {
    budgetFitBand: band,
    budgetFitScore: Math.min(1, Math.max(0, score)),
    stretchBudgetRequired: stretch,
    affordabilityRiskLevel: risk,
    budgetFitReason: reason,
    cheaperAlternativesJson: JSON.stringify(alts),
    phasedInstallOptionJson: phased ? JSON.stringify(phased) : null,
    downgradeSuggestionJson:
      band === "over_budget" || band === "stretch_required"
        ? JSON.stringify({ suggestions: alts.slice(0, 3) })
        : null,
  };
}

export async function persistBudgetFitAssessment(data: Prisma.BudgetFitAssessmentCreateInput) {
  return db.budgetFitAssessment.create({ data });
}
