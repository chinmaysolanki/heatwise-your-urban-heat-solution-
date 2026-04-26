/**
 * Mirrors ``ml/serving/manifests/runtime_contract.json`` (subset for API handlers).
 */

import type { Recommendation } from "@/models";
import type { SpeciesIdentityRef } from "@/lib/species/speciesIdentityTypes";
import type { CandidatePricingBlock } from "@/lib/ml/pricingTypes";
import type { SupplyConstraintsPayloadV1 } from "@/lib/ml/supplyConstraintTypes";

export type BlendWeightsInput = {
  rules?: number;
  feasibilityMl?: number;
  heatMl?: number;
  rankingMl?: number;
};

export type RecommendationEvaluationContext = {
  assignmentKey?: string;
  experimentId?: string | null;
  projectType?: string | null;
  climateZone?: string | null;
  cityTier?: string | null;
  /** Optional explicit region for supply / installer signals */
  region?: string | null;
  internalUser?: boolean;
};

export type RecommendationGenerateRequest = {
  project: Record<string, unknown>;
  environment: Record<string, unknown>;
  preferences: Record<string, unknown>;
  projectId?: string;
  /** Optional: link persisted recommendation runs / layout orchestration to a photo session. */
  photoSessionId?: string;
  userId?: string | null;
  maxCandidates?: number;
  blendWeights?: BlendWeightsInput;
  rulesVersion?: string;
  registryDir?: string;
  speciesCsvPath?: string;
  /** When set with HEATWISE_ENABLE_SHADOW_EVAL=1, enables assignment + optional shadow dual-run (response is still primary-only). */
  evaluationContext?: RecommendationEvaluationContext | null;
  /**
   * Optional supply-side constraints (usually injected server-side from Prisma).
   * Clients may omit; set ``skipSupplyConstraints: true`` to force-disable injection.
   */
  supplyConstraints?: SupplyConstraintsPayloadV1;
  skipSupplyConstraints?: boolean;
  /** When true, skip server-side per-candidate pricing enrichment. */
  skipPricingEnrichment?: boolean;
  /** When true, skip geo/microclimate merge into environment. */
  skipGeoEnrichment?: boolean;
};

export type CandidateScoreBreakdown = {
  rulePrior?: number;
  feasibilityMl?: number | null;
  heatMl?: number | null;
  rankingMl?: number | null;
  blended: number;
  blendParts?: Record<string, number>;
};

export type RuntimeCandidate = {
  candidateId: string;
  rank: number;
  blocked: boolean;
  blockReasons?: string[];
  scores: CandidateScoreBreakdown;
  candidatePayload: Record<string, unknown>;
  explanation: {
    summaryBullets: string[];
    componentScores?: Record<string, number>;
    finalBlendedScore?: number;
    mlHeadsUsed?: Record<string, boolean>;
    blocked?: boolean;
    substituted_species?: { from: string; to: string } | null;
    blocked_due_to_supply?: string[];
    blocked_due_to_season?: string[];
    operational_risk_level?: string;
    lead_time_note?: string | null;
    regional_readiness_note?: string | null;
    recommended_now_vs_later?: string;
    confidence_adjustment_reason?: string | null;
    geo_risk_summary_json?: string;
    heat_exposure_note?: string;
    wind_exposure_note?: string;
    irrigation_risk_note?: string;
    seasonal_stress_note?: string;
    cooling_opportunity_note?: string;
    biodiversity_opportunity_note?: string;
    confidence_note?: string;
    location_specific_adjustments_json?: string;
    geo_adjustment_multiplier?: number;
  };
  /** Install / maintenance ranges and budget fit (Node pricing layer). */
  pricing?: CandidatePricingBlock;
  /** Node-only: canonical SpeciesCatalog.code resolution for telemetry / training joins (Phase 5). */
  heatwiseSpeciesResolution?: SpeciesIdentityRef;
};

export type TelemetryMeta = {
  generatorSource: string;
  rulesVersion: string;
  modelVersionFeasibility?: string | null;
  modelVersionHeat?: string | null;
  modelVersionRanking?: string | null;
  mlErrors?: string[];
  supplyConstraints?: Record<string, unknown>;
  geoIntelligence?: Record<string, unknown>;
  geoEnrichmentSnapshotId?: string | null;
};

export type EnrichmentPhaseStatus = "applied" | "skipped" | "failed";

export type EnrichmentWarning = {
  phase: "geo" | "supply" | "pricing" | "shadow_eval" | "layout";
  code: string;
  message: string;
};

/** Server-side enrichment outcome (geo merge, supply payload, per-candidate pricing). */
export type RecommendationEnrichmentStatus = {
  geo: EnrichmentPhaseStatus;
  supply: EnrichmentPhaseStatus;
  pricing: EnrichmentPhaseStatus;
  /** Whether a geo snapshot row was written (requires projectId + policy). */
  persistedGeoSnapshot: boolean;
  /** Whether a constraint snapshot row was written (requires projectId + policy). */
  persistedConstraintSnapshot: boolean;
};

/** Optional 3D layout slate (same shape as POST /api/generate-layout) attached by the canonical orchestrator. */
export type LayoutGenerationAttachment = {
  recommendations: Recommendation[];
  durationMs: number;
  totalCandidates: number;
  mlTelemetryMeta: TelemetryMeta | null;
  mlMode: "full_ml" | "rules_only" | "partial_ml" | null;
};

/** Explicit layout attachment outcome for the main app and ops (Phase 4). */
export type LayoutSlateMeta = {
  eligible: boolean;
  status: "attached" | "skipped_ineligible" | "failed";
  ineligibleReason?: string;
  failureCode?: string;
  failureMessage?: string;
};

export type RecommendationGenerateResponse = {
  mode: "full_ml" | "rules_only" | "partial_ml";
  /** Set by ``python -m serving`` on successful stdout only (optional on older runtimes). */
  heatwiseServingOk?: boolean;
  candidates: RuntimeCandidate[];
  telemetryMeta: TelemetryMeta;
  runExplanation?: Record<string, unknown>;
  errors?: string[];
  /** Echo of applied supply context + readiness (Python runtime). */
  supplyIntelligenceMeta?: Record<string, unknown>;
  /** Pricing rules version + enrichment summary. */
  pricingIntelligenceMeta?: Record<string, unknown>;
  /** Geo enrichment summary + optional snapshot id for telemetry joins. */
  geoIntelligenceMeta?: Record<string, unknown>;
  /** Non-fatal enrichment issues (generation still returned). */
  enrichmentWarnings?: EnrichmentWarning[];
  /** Whether each enrichment ran, was skipped by flags/env, or failed. */
  enrichmentStatus?: RecommendationEnrichmentStatus;
  /** True if geo, supply, or pricing enrichment ended in `failed`. */
  enrichmentDegraded?: boolean;
  /** True if response is usable but enrichment had failures or non-fatal warnings (see enrichmentWarnings). */
  enrichmentPartialSuccess?: boolean;
  /**
   * When derivable from project/environment/preferences, includes TS layout pipeline output + spatial/heat summaries.
   * Server persists RecommendationRun when layout is attached (`persistLayoutRun` on orchestrator); main app uses this endpoint as primary.
   */
  layoutGeneration?: LayoutGenerationAttachment;
  /**
   * Whether a layout slate was required, attached, skipped, or failed — always set by POST /api/recommendations/generate (Phase 4).
   */
  layoutSlate?: LayoutSlateMeta;
};
