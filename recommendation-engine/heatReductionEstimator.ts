// ============================================================
// HeatWise — Heat Reduction Estimator
// recommendation-engine/heatReductionEstimator.ts
//
// Derives a richer HeatReductionSummary from a Recommendation
// and its LayoutSchema by analysing plant density, shade /
// reflective coverage, and effective surface area.
// ============================================================

import type {
  Recommendation,
  HeatReductionSummary,
  LayoutSchema,
} from "@/models";

export function buildHeatReductionSummary(
  rec: Recommendation,
  layout: LayoutSchema = rec.layoutSchema,
): HeatReductionSummary {
  const area = layout.canvasWidthM * layout.canvasLengthM;

  // Approximate coverage ratios from zones
  let plantArea = 0;
  let shadeArea = 0;
  let reflectiveArea = 0;

  for (const zone of layout.zones) {
    const zoneArea = zone.widthM * zone.lengthM;
    if (zone.type === "plant")   plantArea += zoneArea;
    if (zone.type === "module") {
      if (/shade|pergola/i.test(zone.label)) shadeArea += zoneArea;
      if (/reflect|white|cool roof/i.test(zone.label)) reflectiveArea += zoneArea;
    }
  }

  const plantCoverageRatio      = clamp01(plantArea / area || 0);
  const shadeCoverageRatio      = clamp01(shadeArea / area || 0);
  const reflectiveCoverageRatio = clamp01(reflectiveArea / area || 0);

  // Start from candidate-level heat estimate
  const base = rec.candidate.heatEstimate.valueC;

  // Apply small multipliers based on coverage quality
  const plantBoost      = 1 + plantCoverageRatio * 0.25;
  const shadeBoost      = 1 + shadeCoverageRatio * 0.20;
  const reflectiveBoost = 1 + reflectiveCoverageRatio * 0.10;

  const estimatedDropC = round1(
    base * plantBoost * shadeBoost * reflectiveBoost,
  );

  const drivers: string[] = [];
  if (plantCoverageRatio > 0.6) drivers.push("High vegetative coverage");
  if (shadeCoverageRatio > 0.3) drivers.push("Significant structural shade");
  if (reflectiveCoverageRatio > 0.2) drivers.push("Meaningful reflective surface area");
  if (!drivers.length) drivers.push("Moderate cooling from baseline green infrastructure");

  return {
    estimatedDropC,
    plantCoverageRatio,
    shadeCoverageRatio,
    reflectiveCoverageRatio,
    effectiveSurfaceAreaM2: round1(area),
    confidence: rec.candidate.heatEstimate.confidence,
    drivers,
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

