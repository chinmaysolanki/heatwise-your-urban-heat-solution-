/**
 * Phase 6: canonical learning telemetry metadata + legacy → canonical event mapping.
 * DB `RecommendationTelemetryEvent.eventType` may be canonical or legacy; `metadataJson.schema` is `hw_telemetry_v1`.
 */

export const HW_TELEMETRY_SCHEMA_VERSION = "hw_telemetry_v1";

/** Canonical names for recommendation learning exports (use as `eventType` or via metadata.canonicalEvent). */
export const CANONICAL_LEARNING_EVENT_TYPES = [
  "recommendation_run_viewed",
  "candidate_viewed",
  "candidate_selected",
  "candidate_dismissed",
  "candidate_rated_positive",
  "candidate_rated_negative",
  "visualization_requested",
  "report_opened",
  "installer_export_requested",
  "installation_request_started",
] as const;

export type CanonicalLearningEventType = (typeof CANONICAL_LEARNING_EVENT_TYPES)[number];

/**
 * Maps stored legacy `eventType` → canonical label for training joins.
 * If absent, `eventType` is treated as already canonical.
 */
export const LEGACY_TO_CANONICAL: Record<string, string> = {
  recommendation_impression: "candidate_viewed",
  recommendation_view: "recommendation_run_viewed",
  recommendation_expand: "candidate_viewed",
  recommendation_compare: "candidate_viewed",
  recommendation_select: "candidate_selected",
  recommendation_dismiss: "candidate_dismissed",
  recommendation_save: "candidate_viewed",
  recommendation_unsave: "candidate_dismissed",
  recommendation_share: "recommendation_run_viewed",
  recommendation_request_regenerate: "candidate_dismissed",
  recommendation_request_ar_preview: "visualization_requested",
  recommendation_request_before_after: "visualization_requested",
  recommendation_request_installer: "installation_request_started",
  recommendation_feedback_positive: "candidate_rated_positive",
  recommendation_feedback_negative: "candidate_rated_negative",
};

export type TelemetryMetadataV1 = {
  schema: typeof HW_TELEMETRY_SCHEMA_VERSION;
  canonicalEvent: string;
  legacyEventType?: string;
  projectId: string;
  photoSessionId?: string | null;
  recommendationRunId?: string | null;
  candidateSnapshotId?: string | null;
  speciesCatalogCodes?: string[];
  heatwiseSurface?: string | null;
  /** ISO timestamp when the server recorded the event */
  recordedAtIso?: string;
  [key: string]: unknown;
};

export function enrichTelemetryEventMetadata(
  existing: Record<string, unknown> | null | undefined,
  ctx: {
    eventType: string;
    projectId: string;
    sessionPhotoSessionId?: string | null;
    legacyRecommendationRunId?: string | null;
    candidateSnapshotId?: string | null;
    screenName?: string | null;
    uiPosition?: number | null;
  },
): TelemetryMetadataV1 {
  const ex = existing && typeof existing === "object" ? { ...existing } : {};
  const incomingLegacy =
    typeof ex.legacyEventType === "string" && ex.legacyEventType.length > 0 ? ex.legacyEventType : undefined;
  const canonicalEvent = LEGACY_TO_CANONICAL[ctx.eventType] ?? ctx.eventType;
  const legacyEventType = LEGACY_TO_CANONICAL[ctx.eventType] ? ctx.eventType : incomingLegacy;

  const recommendationRunId =
    (typeof ex.recommendationRunId === "string" ? ex.recommendationRunId : null) ??
    ctx.legacyRecommendationRunId ??
    null;
  const photoSessionId =
    (typeof ex.photoSessionId === "string" ? ex.photoSessionId : null) ?? ctx.sessionPhotoSessionId ?? null;
  const candidateSnapshotId =
    (typeof ex.candidateSnapshotId === "string" ? ex.candidateSnapshotId : null) ??
    ctx.candidateSnapshotId ??
    null;

  delete ex.schema;
  delete ex.canonicalEvent;
  delete ex.legacyEventType;
  delete ex.recordedAtIso;

  const speciesCatalogCodes = Array.isArray(ex.speciesCatalogCodes)
    ? (ex.speciesCatalogCodes as unknown[]).filter((x): x is string => typeof x === "string")
    : undefined;

  return {
    ...ex,
    schema: HW_TELEMETRY_SCHEMA_VERSION,
    canonicalEvent,
    projectId: ctx.projectId,
    photoSessionId,
    recommendationRunId,
    candidateSnapshotId,
    heatwiseSurface: ctx.screenName ?? (typeof ex.heatwiseSurface === "string" ? ex.heatwiseSurface : null),
    uiPosition: ctx.uiPosition ?? (typeof ex.uiPosition === "number" ? ex.uiPosition : undefined),
    ...(legacyEventType ? { legacyEventType } : {}),
    ...(speciesCatalogCodes?.length ? { speciesCatalogCodes } : {}),
    recordedAtIso: new Date().toISOString(),
  };
}
