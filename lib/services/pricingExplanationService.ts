import type { CandidatePricingBlock, EstimateConfidenceBand } from "@/lib/ml/pricingTypes";

export function uncertaintyReasons(args: {
  confidenceBand: EstimateConfidenceBand;
  supplyOperationalRisk?: string | null;
  regionNote?: string | null;
  leadTimeHeavy?: boolean;
}): string[] {
  const out: string[] = [];
  if (args.confidenceBand === "very_wide" || args.confidenceBand === "wide") {
    out.push("Wide cost band due to site variability and regional execution factors.");
  }
  if (args.supplyOperationalRisk === "high") {
    out.push("High uncertainty due to regional supply variability.");
  }
  if (args.leadTimeHeavy) {
    out.push("Long lead-time items increase quote volatility.");
  }
  if (args.regionNote) out.push(args.regionNote);
  if (!out.length) out.push("Estimates use hybrid heuristics; confirm with installer quotes.");
  return out;
}

export function majorCostDriversList(args: {
  shadeSolution: string;
  irrigationType: string;
  greeneryDensity: string;
  planterType: string;
  areaSqm: number;
  projectType: string;
}): string[] {
  const d: string[] = [];
  d.push(`Treated area ~${args.areaSqm.toFixed(1)} sqm (${args.projectType}).`);
  if (args.shadeSolution && args.shadeSolution !== "none") {
    d.push(`Shade / structure: ${args.shadeSolution}.`);
  }
  d.push(`Greenery intensity: ${args.greeneryDensity}; planter system: ${args.planterType}.`);
  d.push(`Irrigation: ${args.irrigationType}.`);
  return d;
}

export function cheaperAlternativesList(args: {
  shadeSolution: string;
  irrigationType: string;
  planterType: string;
}): string[] {
  const alts: string[] = [];
  if (args.shadeSolution === "pergola" || args.shadeSolution === "green_wall_segment") {
    alts.push("Consider shade sail or minimal shade to reduce structural cost.");
  }
  if (args.irrigationType === "drip" || args.irrigationType === "automatic") {
    alts.push("Manual watering plan reduces irrigation hardware cost.");
  }
  if (args.planterType === "raised") {
    alts.push("Container-based layout often lowers civil work cost on small sites.");
  }
  if (!alts.length) alts.push("Reduce greenery density or phase planting to spread cost.");
  return alts;
}

export function phasedInstallHint(overBudget: boolean, stretch: boolean): Record<string, unknown> | null {
  if (!overBudget && !stretch) return null;
  return {
    suggested: true,
    phases: [
      { phase: 1, focus: "Structural shade / planters + soil prep", note: "Lock layout early." },
      { phase: 2, focus: "Planting + irrigation completion", note: "After monsoon window if applicable." },
    ],
  };
}

export function volatilityNoteText(volatility: number, contingency: number | null): string | null {
  if (volatility >= 0.55) {
    return `Elevated quote volatility (${(volatility * 100).toFixed(0)}%); allow ${contingency ?? 8}% contingency in planning.`;
  }
  if (volatility >= 0.35) {
    return "Moderate quote volatility — site visit may move price within the band.";
  }
  return null;
}

export function finalizeExplanationJson(
  block: CandidatePricingBlock,
  opts?: { supplyOperationalRisk?: string | null },
): CandidatePricingBlock {
  const unc = uncertaintyReasons({
    confidenceBand: block.estimateConfidenceBand,
    supplyOperationalRisk: opts?.supplyOperationalRisk ?? null,
    leadTimeHeavy: block.quoteVolatilityScore > 0.45,
  });
  return {
    ...block,
    majorCostDriversJson: JSON.stringify(block.majorCostDrivers),
    uncertaintyReasonsJson: JSON.stringify(unc),
    cheaperAlternativesJson: JSON.stringify(block.costReductionAlternatives),
  };
}
