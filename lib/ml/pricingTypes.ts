import type { SupplyConstraintsPayloadV1 } from "@/lib/ml/supplyConstraintTypes";

export const PRICING_RULES_VERSION = "hw-pricing-rules-v1.0";

/** Subset of evaluation context used for pricing (avoids circular imports). */
export type PricingEvalContext = {
  cityTier?: string | null;
  climateZone?: string | null;
  region?: string | null;
  projectType?: string | null;
};

export type EstimateConfidenceBand = "tight" | "medium" | "wide" | "very_wide";

export type CostRangeInr = { min: number; median: number; max: number };

/** Per-candidate block attached after runtime scoring (Node enrichment). */
export type CandidatePricingBlock = {
  installCostRange: CostRangeInr;
  annualMaintenanceRange: CostRangeInr;
  medianCostEstimate: number;
  estimateConfidenceBand: EstimateConfidenceBand;
  budgetFitScore: number | null;
  affordabilityRiskLevel: "low" | "medium" | "high";
  quoteVolatilityScore: number;
  volatilityNote: string | null;
  majorCostDrivers: string[];
  costReductionAlternatives: string[];
  phaseableRecommendation: boolean;
  estimateSource: "rules" | "hybrid" | "ml" | "installer_benchmark";
  pricingRulesVersion: string;
  contingencyPct: number | null;
  materialCostComponentInr: number | null;
  laborCostComponentInr: number | null;
  irrigationCostComponentInr: number | null;
  shadeSystemCostComponentInr: number | null;
  logisticsCostComponentInr: number | null;
  majorCostDriversJson: string;
  uncertaintyReasonsJson: string;
  budgetFitReason: string | null;
  cheaperAlternativesJson: string;
  phasedInstallOptionJson: string | null;
  quoteAlignmentNote: string | null;
  predictedVsActualNote: string | null;
};

export type PricingContextInput = {
  project: Record<string, unknown>;
  environment: Record<string, unknown>;
  preferences: Record<string, unknown>;
  evaluationContext?: PricingEvalContext | null;
  supplyConstraints?: SupplyConstraintsPayloadV1 | null;
  userBudgetInr?: number | null;
};

export type BudgetFitBand =
  | "comfortably_within_budget"
  | "near_budget_limit"
  | "stretch_required"
  | "over_budget"
  | "high_uncertainty";

export type BudgetFitResult = {
  budgetFitBand: BudgetFitBand;
  budgetFitScore: number;
  stretchBudgetRequired: boolean;
  affordabilityRiskLevel: "low" | "medium" | "high";
  budgetFitReason: string;
  cheaperAlternativesJson: string;
  phasedInstallOptionJson: string | null;
  downgradeSuggestionJson: string | null;
};

export type QuoteComparisonDiagnostics = {
  pricingAccuracyBand: string;
  flags: string[];
  predictedVsActualNote: string | null;
  quoteAlignmentNote: string | null;
  installCostErrorAbsInr: number | null;
  installCostErrorPct: number | null;
  quoteToFinalDeltaInr: number | null;
  quoteToFinalDeltaPct: number | null;
};
