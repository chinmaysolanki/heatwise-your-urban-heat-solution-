import type { Recommendation } from "@/models";
import type {
  LayoutGenerationAttachment,
  LayoutSlateMeta,
  RecommendationGenerateResponse,
  RuntimeCandidate,
} from "@/lib/ml/recommendationRuntimeTypes";

import type { TrafficChannel } from "@/lib/recommendation/recommendationRuntimeFingerprint";

export type RuntimePathCategory =
  | "python_usable"
  | "catalog_hybrid_ts"
  | "rules_only_emergency"
  | "empty_response"
  | "handler_error"
  | "client_error";

export type ObservationKind = "success" | "client_error" | "handler_error";

export type RecommendationRuntimeObservationPayload = {
  observationKind: ObservationKind;
  outcomeHttpStatus: number;
  errorCode: string | null;
  errorMessageTruncated: string | null;

  requestFingerprint: string;
  trafficChannel: TrafficChannel;

  projectId: string | null;
  runtimePathCategory: RuntimePathCategory;
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
  mlErrorsTruncated: string | null;
};

function extractFallbackReasonTag(mlErrors: string[] | undefined): string | null {
  if (!mlErrors?.length) return null;
  for (const e of mlErrors) {
    const s = String(e);
    if (s.startsWith("catalog_fallback_reason:")) return s.slice(0, 200);
  }
  return null;
}

function countOpenCandidates(candidates: RuntimeCandidate[]): number {
  return candidates.filter((c) => !c.blocked).length;
}

function countCandidatesWithSpeciesCatalogCode(candidates: RuntimeCandidate[]): number {
  let n = 0;
  for (const c of candidates) {
    const p = c.candidatePayload as Record<string, unknown>;
    const code = p.species_catalog_code;
    if (typeof code === "string" && code.trim()) n++;
  }
  return n;
}

function classifyRuntimePath(out: RecommendationGenerateResponse): RuntimePathCategory {
  const gen = (out.telemetryMeta?.generatorSource ?? "").trim();
  const errs = out.telemetryMeta?.mlErrors ?? [];
  const errStr = errs.map((e) => String(e));

  if (gen === "catalog_hybrid_ts") return "catalog_hybrid_ts";

  const emergency =
    errStr.some((e) => e.includes("python_runtime_unavailable_ts_fallback")) ||
    errStr.some((e) => e.includes("catalog_hybrid_no_species_data_emergency_rules_only")) ||
    errStr.some((e) => e.includes("catalog_hybrid_all_species_filtered_emergency_rules_only"));
  if (emergency && gen === "live_rules") return "rules_only_emergency";

  const cands = out.candidates ?? [];
  if (cands.length === 0) return "empty_response";

  return "python_usable";
}

function countUnresolvedLayoutIdentities(recs: Recommendation[] | undefined): number {
  if (!recs?.length) return 0;
  let n = 0;
  for (const r of recs) {
    const id = r.primarySpeciesIdentity;
    if (!id || id.resolution === "unresolved" || !id.catalogCode) n++;
  }
  return n;
}

export type ObservationMeta = {
  requestFingerprint: string;
  trafficChannel: TrafficChannel;
};

/**
 * Build a DB-ready observation row from the canonical generate response + layout attachment outcome.
 */
export function buildRecommendationRuntimeObservationPayload(
  out: RecommendationGenerateResponse,
  layoutSlate: LayoutSlateMeta | undefined,
  layoutGeneration: LayoutGenerationAttachment | undefined,
  projectId: string | null | undefined,
  meta: ObservationMeta,
): RecommendationRuntimeObservationPayload {
  const cands = out.candidates ?? [];
  const mlErrors = out.telemetryMeta?.mlErrors ?? [];
  let mlJson: string | null = null;
  try {
    mlJson = JSON.stringify(mlErrors).slice(0, 2000);
  } catch {
    mlJson = null;
  }

  return {
    observationKind: "success",
    outcomeHttpStatus: 200,
    errorCode: null,
    errorMessageTruncated: null,
    requestFingerprint: meta.requestFingerprint,
    trafficChannel: meta.trafficChannel,
    projectId: typeof projectId === "string" && projectId.length > 0 ? projectId : null,
    runtimePathCategory: classifyRuntimePath(out),
    generatorSource: out.telemetryMeta?.generatorSource ?? null,
    mlMode: out.mode ?? null,
    heatwiseServingOk: typeof out.heatwiseServingOk === "boolean" ? out.heatwiseServingOk : null,
    candidateTotal: cands.length,
    candidateOpen: countOpenCandidates(cands),
    candidatesWithSpeciesCode: countCandidatesWithSpeciesCatalogCode(cands),
    layoutRecommendationCount: layoutGeneration?.recommendations?.length ?? 0,
    layoutUnresolvedIdentityCount: countUnresolvedLayoutIdentities(layoutGeneration?.recommendations),
    layoutSlateStatus: layoutSlate?.status ?? null,
    layoutFailureCode: layoutSlate?.status === "failed" ? layoutSlate.failureCode ?? null : null,
    fallbackReasonTag: extractFallbackReasonTag(mlErrors),
    mlErrorsTruncated: mlJson,
  };
}

export function buildClientErrorObservationPayload(
  params: {
    projectId: string | null | undefined;
    errorCode: string;
    message: string;
    meta: ObservationMeta;
    /** Defaults to 400 (validation). Use 405 for wrong HTTP method. */
    outcomeHttpStatus?: number;
  },
): RecommendationRuntimeObservationPayload {
  const msg = params.message.slice(0, 1500);
  const status = params.outcomeHttpStatus ?? 400;
  return {
    observationKind: "client_error",
    outcomeHttpStatus: status,
    errorCode: params.errorCode,
    errorMessageTruncated: msg,
    requestFingerprint: params.meta.requestFingerprint,
    trafficChannel: params.meta.trafficChannel,
    projectId: typeof params.projectId === "string" && params.projectId.length > 0 ? params.projectId : null,
    runtimePathCategory: "client_error",
    generatorSource: null,
    mlMode: null,
    heatwiseServingOk: null,
    candidateTotal: 0,
    candidateOpen: 0,
    candidatesWithSpeciesCode: 0,
    layoutRecommendationCount: 0,
    layoutUnresolvedIdentityCount: 0,
    layoutSlateStatus: null,
    layoutFailureCode: null,
    fallbackReasonTag: null,
    mlErrorsTruncated: null,
  };
}

export function buildHandlerErrorObservationPayload(
  params: {
    projectId: string | null | undefined;
    errorCode: string;
    message: string;
    meta: ObservationMeta;
    partialOut?: RecommendationGenerateResponse | null;
    layoutSlate?: LayoutSlateMeta;
    layoutGeneration?: LayoutGenerationAttachment;
  },
): RecommendationRuntimeObservationPayload {
  const msg = params.message.slice(0, 1500);
  const partial = params.partialOut;
  const cands = partial?.candidates ?? [];
  const mlErrors = partial?.telemetryMeta?.mlErrors ?? [];
  let mlJson: string | null = null;
  try {
    mlJson = mlErrors.length ? JSON.stringify(mlErrors).slice(0, 2000) : null;
  } catch {
    mlJson = null;
  }

  return {
    observationKind: "handler_error",
    outcomeHttpStatus: 500,
    errorCode: params.errorCode,
    errorMessageTruncated: msg,
    requestFingerprint: params.meta.requestFingerprint,
    trafficChannel: params.meta.trafficChannel,
    projectId: typeof params.projectId === "string" && params.projectId.length > 0 ? params.projectId : null,
    runtimePathCategory: "handler_error",
    generatorSource: partial?.telemetryMeta?.generatorSource ?? null,
    mlMode: partial?.mode ?? null,
    heatwiseServingOk: typeof partial?.heatwiseServingOk === "boolean" ? partial.heatwiseServingOk : null,
    candidateTotal: cands.length,
    candidateOpen: countOpenCandidates(cands),
    candidatesWithSpeciesCode: countCandidatesWithSpeciesCatalogCode(cands),
    layoutRecommendationCount: params.layoutGeneration?.recommendations?.length ?? 0,
    layoutUnresolvedIdentityCount: countUnresolvedLayoutIdentities(params.layoutGeneration?.recommendations),
    layoutSlateStatus: params.layoutSlate?.status ?? null,
    layoutFailureCode: params.layoutSlate?.status === "failed" ? params.layoutSlate.failureCode ?? null : null,
    fallbackReasonTag: extractFallbackReasonTag(mlErrors),
    mlErrorsTruncated: mlJson,
  };
}
