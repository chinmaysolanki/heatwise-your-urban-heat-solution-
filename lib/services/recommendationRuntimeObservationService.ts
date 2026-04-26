import { db } from "@/lib/db";
import type { AdminDateWindow } from "@/lib/services/adminAnalyticsService";
import type { RecommendationRuntimeObservationPayload } from "@/lib/recommendation/buildRecommendationRuntimeObservation";
import type {
  RecommendationRuntimeObservabilityPayload,
  RolloutGuardrailBundle,
} from "@/lib/recommendation/recommendationRuntimeObservationTypes";
import {
  evaluateRolloutGuardrails,
  loadRolloutGuardrailThresholds,
} from "@/lib/recommendation/recommendationRolloutGuardrails";
import { recommendationRuntimeDedupeWindowMs } from "@/lib/recommendation/recommendationRuntimeFingerprint";

export type { RecommendationRuntimeObservabilityPayload } from "@/lib/recommendation/recommendationRuntimeObservationTypes";

type ObsRow = {
  runtimePathCategory: string;
  generatorSource: string | null;
  fallbackReasonTag: string | null;
  layoutSlateStatus: string | null;
  candidateTotal: number;
  candidatesWithSpeciesCode: number;
  layoutUnresolvedIdentityCount: number;
  observationKind: string;
  trafficChannel: string;
};

export async function persistRecommendationRuntimeObservation(
  payload: RecommendationRuntimeObservationPayload,
): Promise<{ persisted: boolean; dedupeSkipped: boolean }> {
  const windowMs = recommendationRuntimeDedupeWindowMs();
  // Dedupe only successes: duplicate compat/shadow HTTP double-calls skew path shares;
  // do not suppress a success after a failure (or multiple distinct errors) for the same fingerprint.
  if (windowMs > 0 && payload.observationKind === "success") {
    const since = new Date(Date.now() - windowMs);
    const dup = await db.recommendationRuntimeObservation.findFirst({
      where: {
        requestFingerprint: payload.requestFingerprint,
        trafficChannel: payload.trafficChannel,
        observationKind: "success",
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (dup) {
      if (process.env.HEATWISE_RUNTIME_LOG_JSON === "1") {
        console.info(
          JSON.stringify({
            type: "heatwise_recommendation_runtime_dedupe_skip_v1",
            requestFingerprint: payload.requestFingerprint,
            trafficChannel: payload.trafficChannel,
          }),
        );
      }
      return { persisted: false, dedupeSkipped: true };
    }
  }

  await db.recommendationRuntimeObservation.create({
    data: {
      projectId: payload.projectId,
      observationKind: payload.observationKind,
      outcomeHttpStatus: payload.outcomeHttpStatus,
      errorCode: payload.errorCode,
      errorMessageTruncated: payload.errorMessageTruncated,
      requestFingerprint: payload.requestFingerprint,
      trafficChannel: payload.trafficChannel,
      runtimePathCategory: payload.runtimePathCategory,
      generatorSource: payload.generatorSource,
      mlMode: payload.mlMode,
      heatwiseServingOk: payload.heatwiseServingOk,
      candidateTotal: payload.candidateTotal,
      candidateOpen: payload.candidateOpen,
      candidatesWithSpeciesCode: payload.candidatesWithSpeciesCode,
      layoutRecommendationCount: payload.layoutRecommendationCount,
      layoutUnresolvedIdentityCount: payload.layoutUnresolvedIdentityCount,
      layoutSlateStatus: payload.layoutSlateStatus,
      layoutFailureCode: payload.layoutFailureCode,
      fallbackReasonTag: payload.fallbackReasonTag,
      mlErrorsTruncated: payload.mlErrorsTruncated,
    },
  });
  return { persisted: true, dedupeSkipped: false };
}

export function scheduleRecommendationRuntimeObservation(
  payload: RecommendationRuntimeObservationPayload,
): void {
  void persistRecommendationRuntimeObservation(payload).catch((e) => {
    console.error("[recommendationRuntimeObservation] persist failed", e);
  });
}

function share(count: number, total: number): number | null {
  if (total <= 0) return null;
  return count / total;
}

function rollupRows(rows: ObsRow[]): {
  pathCounts: Record<string, number>;
  genCounts: Record<string, number>;
  fallbackCounts: Record<string, number>;
  layoutCounts: Record<string, number>;
  emptyCandidates: number;
  sumSpeciesCoverage: number;
  speciesCoverageN: number;
  sumLayoutUnresolved: number;
  layoutAttached: number;
  layoutFailed: number;
  layoutSkipped: number;
  inputs: {
    n: number;
    catalogHybridCount: number;
    rulesEmergencyCount: number;
    sumSpeciesCoverage: number;
    speciesCoverageN: number;
    layoutAttached: number;
    layoutFailed: number;
  };
} {
  const pathCounts: Record<string, number> = {};
  const genCounts: Record<string, number> = {};
  const fallbackCounts: Record<string, number> = {};
  const layoutCounts: Record<string, number> = {};

  let emptyCandidates = 0;
  let sumSpeciesCoverage = 0;
  let speciesCoverageN = 0;
  let sumLayoutUnresolved = 0;
  let layoutAttached = 0;
  let layoutFailed = 0;
  let layoutSkipped = 0;

  for (const r of rows) {
    pathCounts[r.runtimePathCategory] = (pathCounts[r.runtimePathCategory] ?? 0) + 1;

    const g = r.generatorSource?.trim() || "_unknown";
    genCounts[g] = (genCounts[g] ?? 0) + 1;
    if (r.fallbackReasonTag) {
      const k = r.fallbackReasonTag;
      fallbackCounts[k] = (fallbackCounts[k] ?? 0) + 1;
    }
    const ls = r.layoutSlateStatus?.trim() || "_unknown";
    layoutCounts[ls] = (layoutCounts[ls] ?? 0) + 1;

    if (r.candidateTotal === 0) emptyCandidates++;
    if (r.candidateTotal > 0) {
      sumSpeciesCoverage += r.candidatesWithSpeciesCode / r.candidateTotal;
      speciesCoverageN++;
    }
    sumLayoutUnresolved += r.layoutUnresolvedIdentityCount;

    if (r.layoutSlateStatus === "attached") layoutAttached++;
    else if (r.layoutSlateStatus === "failed") layoutFailed++;
    else if (r.layoutSlateStatus === "skipped_ineligible") layoutSkipped++;
  }

  const n = rows.length;
  const catalogHybridCount = pathCounts.catalog_hybrid_ts ?? 0;
  const rulesEmergencyCount = pathCounts.rules_only_emergency ?? 0;

  return {
    pathCounts,
    genCounts,
    fallbackCounts,
    layoutCounts,
    emptyCandidates,
    sumSpeciesCoverage,
    speciesCoverageN,
    sumLayoutUnresolved,
    layoutAttached,
    layoutFailed,
    layoutSkipped,
    inputs: {
      n,
      catalogHybridCount,
      rulesEmergencyCount,
      sumSpeciesCoverage,
      speciesCoverageN,
      layoutAttached,
      layoutFailed,
    },
  };
}

/** @internal exported for unit-style reuse */
export function buildGuardrailBundleFromRollup(rollup: ReturnType<typeof rollupRows>): RolloutGuardrailBundle {
  const thresholds = loadRolloutGuardrailThresholds();
  const { n, catalogHybridCount, rulesEmergencyCount, sumSpeciesCoverage, speciesCoverageN, layoutAttached, layoutFailed } =
    rollup.inputs;
  const guardInputs = {
    catalogHybridShare: share(catalogHybridCount, n),
    rulesEmergencyShare: share(rulesEmergencyCount, n),
    mlSpeciesCodeCoverageMean: speciesCoverageN > 0 ? sumSpeciesCoverage / speciesCoverageN : null,
    layoutFailureAmongEligibleShare: share(layoutFailed, layoutAttached + layoutFailed),
  };
  return {
    sample_size: n,
    thresholds,
    inputs: guardInputs,
    alerts: evaluateRolloutGuardrails(guardInputs, thresholds),
  };
}

export async function fetchRecommendationRuntimeObservability(
  window: AdminDateWindow,
): Promise<RecommendationRuntimeObservabilityPayload> {
  const rows = await db.recommendationRuntimeObservation.findMany({
    where: { createdAt: { gte: window.start, lte: window.end } },
    select: {
      runtimePathCategory: true,
      generatorSource: true,
      fallbackReasonTag: true,
      layoutSlateStatus: true,
      candidateTotal: true,
      candidatesWithSpeciesCode: true,
      layoutUnresolvedIdentityCount: true,
      observationKind: true,
      trafficChannel: true,
    },
  });

  const nAll = rows.length;
  const kindCounts: Record<string, number> = {};
  const chanCounts: Record<string, number> = {};
  let nHandler = 0;
  let nClient = 0;

  for (const r of rows) {
    kindCounts[r.observationKind] = (kindCounts[r.observationKind] ?? 0) + 1;
    chanCounts[r.trafficChannel] = (chanCounts[r.trafficChannel] ?? 0) + 1;
    if (r.observationKind === "handler_error") nHandler++;
    if (r.observationKind === "client_error") nClient++;
  }

  const successRows = rows.filter((r) => r.observationKind === "success");
  const canonicalSuccessRows = successRows.filter((r) => r.trafficChannel === "canonical");

  const rollupSuccess = rollupRows(successRows);
  const rollupCanonicalSuccess = rollupRows(canonicalSuccessRows);

  const pathShare: Record<string, number | null> = {};
  for (const k of Object.keys(rollupSuccess.pathCounts)) {
    pathShare[k] = share(rollupSuccess.pathCounts[k] ?? 0, successRows.length);
  }

  return {
    window: { start: window.start.toISOString(), end: window.end.toISOString() },
    total_observations: nAll,
    success_observation_count: successRows.length,
    traffic_channel_counts: chanCounts,
    observation_kind_counts: kindCounts,
    runtime_path_counts: rollupSuccess.pathCounts,
    runtime_path_share: pathShare,
    generator_source_counts: rollupSuccess.genCounts,
    fallback_reason_counts: rollupSuccess.fallbackCounts,
    layout_slate_counts: rollupSuccess.layoutCounts,
    aggregates: {
      empty_candidate_responses: rollupSuccess.emptyCandidates,
      mean_ml_species_code_coverage:
        rollupSuccess.speciesCoverageN > 0 ? rollupSuccess.sumSpeciesCoverage / rollupSuccess.speciesCoverageN : null,
      mean_layout_unresolved_identity_per_observation:
        successRows.length > 0 ? rollupSuccess.sumLayoutUnresolved / successRows.length : null,
      layout_attached: rollupSuccess.layoutAttached,
      layout_failed: rollupSuccess.layoutFailed,
      layout_skipped_ineligible: rollupSuccess.layoutSkipped,
      handler_error_share: share(nHandler, nAll),
      client_error_share: share(nClient, nAll),
    },
    guardrails: buildGuardrailBundleFromRollup(rollupSuccess),
    guardrails_canonical_success: buildGuardrailBundleFromRollup(rollupCanonicalSuccess),
  };
}

export type RecommendationRuntimeObservationExportRow = {
  id: string;
  createdAt: string;
  projectId: string | null;
  observationKind: string;
  outcomeHttpStatus: number | null;
  errorCode: string | null;
  errorMessageTruncated: string | null;
  requestFingerprint: string;
  trafficChannel: string;
  runtimePathCategory: string;
  generatorSource: string | null;
  mlMode: string | null;
  heatwiseServingOk: boolean | null;
  candidateTotal: number;
  candidateOpen: number;
  candidatesWithSpeciesCode: number;
  layoutRecommendationCount: number;
  layoutUnresolvedIdentityCount: number;
  layoutSlateStatus: string | null;
  layoutFailureCode: string | null;
  fallbackReasonTag: string | null;
};

export async function fetchRecommendationRuntimeObservationsExport(params: {
  window: AdminDateWindow;
  limit: number;
  cursorId?: string | null;
}): Promise<{ rows: RecommendationRuntimeObservationExportRow[]; nextCursorId: string | null }> {
  const take = Math.min(10_000, Math.max(1, params.limit));
  const rows = await db.recommendationRuntimeObservation.findMany({
    where: {
      createdAt: { gte: params.window.start, lte: params.window.end },
      ...(params.cursorId ? { id: { gt: params.cursorId } } : {}),
    },
    orderBy: { id: "asc" },
    take,
    select: {
      id: true,
      createdAt: true,
      projectId: true,
      observationKind: true,
      outcomeHttpStatus: true,
      errorCode: true,
      errorMessageTruncated: true,
      requestFingerprint: true,
      trafficChannel: true,
      runtimePathCategory: true,
      generatorSource: true,
      mlMode: true,
      heatwiseServingOk: true,
      candidateTotal: true,
      candidateOpen: true,
      candidatesWithSpeciesCode: true,
      layoutRecommendationCount: true,
      layoutUnresolvedIdentityCount: true,
      layoutSlateStatus: true,
      layoutFailureCode: true,
      fallbackReasonTag: true,
    },
  });

  const mapped: RecommendationRuntimeObservationExportRow[] = rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    projectId: r.projectId,
    observationKind: r.observationKind,
    outcomeHttpStatus: r.outcomeHttpStatus,
    errorCode: r.errorCode,
    errorMessageTruncated: r.errorMessageTruncated,
    requestFingerprint: r.requestFingerprint,
    trafficChannel: r.trafficChannel,
    runtimePathCategory: r.runtimePathCategory,
    generatorSource: r.generatorSource,
    mlMode: r.mlMode,
    heatwiseServingOk: r.heatwiseServingOk,
    candidateTotal: r.candidateTotal,
    candidateOpen: r.candidateOpen,
    candidatesWithSpeciesCode: r.candidatesWithSpeciesCode,
    layoutRecommendationCount: r.layoutRecommendationCount,
    layoutUnresolvedIdentityCount: r.layoutUnresolvedIdentityCount,
    layoutSlateStatus: r.layoutSlateStatus,
    layoutFailureCode: r.layoutFailureCode,
    fallbackReasonTag: r.fallbackReasonTag,
  }));

  const nextCursorId = rows.length === take ? rows[rows.length - 1]!.id : null;
  return { rows: mapped, nextCursorId };
}
