import type { FeedbackEventType, GeneratorSource } from "./recommendationTelemetryConstants";

export type StructuredError = {
  code: string;
  message: string;
  details?: unknown;
};

/** Returned on successful writes that may replay prior identical requests. */
export type IdempotencyExecutionMeta = {
  replayed: boolean;
  /** Logical scope (may differ from `IdempotencyRecord.scope` for DB-natural replays). */
  scope: string;
  /** How the replay was detected. */
  via?:
    | "idempotency_store"
    | "telemetry_session_key"
    | "install_outcome_key"
    | "quote_assignment_natural"
    | "verified_install_job_natural";
};

export type CreateRecommendationSessionInput = {
  projectId: string;
  userId?: string | null;
  photoSessionId?: string | null;
  modelVersion: string;
  rulesVersion: string;
  generatorSource: GeneratorSource | string;
  projectSnapshot: Record<string, unknown>;
  environmentSnapshot: Record<string, unknown>;
  preferenceSnapshot: Record<string, unknown>;
  totalCandidates: number;
  latencyMs: number;
  legacyRecommendationRunId?: string | null;
  idempotencyKey?: string | null;
  candidates: CreateCandidateSnapshotInput[];
};

export type CreateCandidateSnapshotInput = {
  candidateRank: number;
  candidateScore?: number | null;
  candidateSource: string;
  candidatePayload: Record<string, unknown>;
  speciesPayload?: Record<string, unknown> | null;
  estimatedInstallCostInr?: number | null;
  estimatedMaintenanceCostInr?: number | null;
  expectedTempReductionC?: number | null;
  expectedSurfaceTempReductionC?: number | null;
  feasibilityScore?: number | null;
  safetyScore?: number | null;
  heatMitigationScore?: number | null;
  waterEfficiencyScore?: number | null;
  wasShownToUser?: boolean;
};

export type LogTelemetryEventInput = {
  feedbackEventId: string;
  sessionId: string;
  candidateSnapshotId?: string | null;
  projectId: string;
  userId?: string | null;
  eventType: FeedbackEventType | string;
  eventTimestamp?: string | Date | null;
  eventSource: string;
  screenName?: string | null;
  uiPosition?: number | null;
  dwellTimeMs?: number | null;
  eventValue?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type SubmitInstallOutcomeInput = {
  projectId: string;
  userId?: string | null;
  telemetrySessionId?: string | null;
  selectedCandidateSnapshotId?: string | null;
  installerId?: string | null;
  installStatus: string;
  installDate?: string | Date | null;
  actualInstallCostInr?: number | null;
  actualMaintenancePlanInr?: number | null;
  installedAreaSqft?: number | null;
  irrigationInstalled?: boolean | null;
  speciesInstalled?: unknown;
  deviationsFromRecommendation?: unknown;
  userSatisfactionScore?: number | null;
  installerFeasibilityRating?: number | null;
  measuredTempChangeC?: number | null;
  measuredSurfaceTempChangeC?: number | null;
  plantSurvivalRate30d?: number | null;
  plantSurvivalRate90d?: number | null;
  maintenanceAdherenceScore?: number | null;
  notes?: string | null;
  idempotencyKey?: string | null;
};

export type CreateSessionResult = {
  recommendationSessionId: string;
  candidateSnapshotIds: string[];
  idempotency?: IdempotencyExecutionMeta;
};
