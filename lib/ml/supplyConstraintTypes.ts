/**
 * Compact v1 payload sent to Python ``run_recommendation_request`` as ``supplyConstraints``.
 * Built by ``recommendationConstraintService`` from Prisma supply tables.
 */

export type SupplyConstraintContextV1 = {
  region: string;
  climateZone: string;
  monthOfYear: number;
  projectType: string;
};

export type SupplyReadinessV1 = {
  supplyReadinessScore: number;
  seasonalReadinessScore: number;
  operationalRiskLevel: "low" | "medium" | "high";
};

export type SupplyConstraintsPayloadV1 = {
  version: 1;
  context: SupplyConstraintContextV1;
  blockedSpecies: string[];
  seasonallyBlockedSpecies: string[];
  blockedMaterials: string[];
  blockedSolutionTypes: string[];
  substitutions: Record<string, string>;
  speciesSoftPenalties: Record<string, { multiplier: number; reason: string }>;
  solutionSoftPenalties: Record<string, { multiplier: number; reason: string }>;
  globalSoftMultiplier: number;
  irrigationSoftMultiplier: number;
  structuralSoftMultiplier: number;
  readiness: SupplyReadinessV1;
  deferInstallSuggested: boolean;
  leadTimeNote: string | null;
  regionalReadinessNote: string | null;
  confidenceAdjustmentReason: string | null;
  explanationNotes: string[];
  /** Optional global hard reasons (e.g. region lockout). */
  hardBlockReasons?: string[];
};

export type ConstraintPreviewResponse = {
  hardBlocks: { kind: string; value: string; reason: string }[];
  softPenalties: { target: string; multiplier: number; reason: string }[];
  suggestedSubstitutions: { from: string; to: string; reason: string }[];
  readiness: SupplyReadinessV1;
  supplyConstraints: SupplyConstraintsPayloadV1;
  notes: string[];
};
