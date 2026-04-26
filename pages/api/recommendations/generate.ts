import type { NextApiRequest, NextApiResponse } from "next";

import type {
  EnrichmentWarning,
  LayoutGenerationAttachment,
  LayoutSlateMeta,
  RecommendationEnrichmentStatus,
  RecommendationGenerateRequest,
  RecommendationGenerateResponse,
} from "@/lib/ml/recommendationRuntimeTypes";
import { orchestrateLayoutRecommendations } from "@/lib/recommendation/orchestrateLayoutRecommendations";
import { getLayoutEligibility } from "@/lib/recommendation/layoutEligibility";
import { shouldPersistConstraintSnapshot, shouldPersistGeoEnrichment } from "@/lib/recommendationProvenanceConfig";
import { assignForRequest, resolveRegistryDirForVariant } from "@/lib/services/experimentAssignmentService";
import { generateRecommendationsRuntime } from "@/lib/services/mlRecommendationService";
import { appendRuntimeEvaluation, evaluatePrimaryVsShadow } from "@/lib/services/recommendationEvaluationService";
import { enrichRecommendationsWithPricing } from "@/lib/services/pricingEstimateService";
import {
  attachGeoExplanationToCandidates,
  buildGeoEnrichmentBundle,
  mergeGeoIntoEnvironment,
  persistGeoEnrichmentChain,
} from "@/lib/services/geoEnrichmentService";
import {
  buildSupplyConstraintsPayload,
  persistConstraintSnapshot,
} from "@/lib/services/recommendationConstraintService";
import { buildEnrichmentResponseMeta } from "@/lib/enrichmentResponseMeta";
import { buildDemoRecommendationPresentation } from "@/lib/demoPresentation";
import {
  buildClientErrorObservationPayload,
  buildHandlerErrorObservationPayload,
  buildRecommendationRuntimeObservationPayload,
} from "@/lib/recommendation/buildRecommendationRuntimeObservation";
import {
  computeRecommendationRuntimeFingerprint,
  resolveRecommendationTrafficChannel,
} from "@/lib/recommendation/recommendationRuntimeFingerprint";
import { scheduleRecommendationRuntimeObservation } from "@/lib/services/recommendationRuntimeObservationService";
import { readJsonBody, sendStructuredError } from "./_utils";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Runtime recommendation generation: rules + ML orchestration (Python) with TS fallback.
 * Pass results to ``create-session`` for telemetry (model/rules versions in ``telemetryMeta``).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const shadowEvalFlag = process.env.HEATWISE_ENABLE_SHADOW_EVAL === "1";

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    const meta405 = {
      requestFingerprint: computeRecommendationRuntimeFingerprint(null, "anonymous"),
      trafficChannel: resolveRecommendationTrafficChannel(req, shadowEvalFlag, false),
    };
    scheduleRecommendationRuntimeObservation(
      buildClientErrorObservationPayload({
        projectId: null,
        errorCode: "METHOD_NOT_ALLOWED",
        message: "POST only",
        meta: meta405,
        outcomeHttpStatus: 405,
      }),
    );
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const body = readJsonBody<RecommendationGenerateRequest>(req.body);
  const assignmentKeyForEarly =
    body?.evaluationContext?.assignmentKey ??
    body?.userId ??
    body?.projectId ??
    (typeof body?.project?.id === "string" ? body.project.id : undefined) ??
    "anonymous";
  const trafficForEarly = resolveRecommendationTrafficChannel(
    req,
    shadowEvalFlag,
    Boolean(body?.evaluationContext),
  );
  const fingerprintForEarly = computeRecommendationRuntimeFingerprint(body, assignmentKeyForEarly);

  if (!body || !body.project || !body.environment || !body.preferences) {
    scheduleRecommendationRuntimeObservation(
      buildClientErrorObservationPayload({
        projectId: body?.projectId,
        errorCode: "INVALID_BODY",
        message: "Expected project, environment, preferences objects",
        meta: { requestFingerprint: fingerprintForEarly, trafficChannel: trafficForEarly },
      }),
    );
    return sendStructuredError(
      res,
      { code: "INVALID_BODY", message: "Expected project, environment, preferences objects" },
      400,
    );
  }

  const warnings: EnrichmentWarning[] = [];
  const enrichmentStatus: RecommendationEnrichmentStatus = {
    geo: "skipped",
    supply: "skipped",
    pricing: "skipped",
    persistedGeoSnapshot: false,
    persistedConstraintSnapshot: false,
  };

  const ctx = body.evaluationContext;
  const assignmentKey =
    ctx?.assignmentKey ??
    body.userId ??
    body.projectId ??
    (typeof body.project?.id === "string" ? body.project.id : undefined) ??
    "anonymous";
  const observationMeta = {
    requestFingerprint: computeRecommendationRuntimeFingerprint(body, assignmentKey),
    trafficChannel: resolveRecommendationTrafficChannel(req, shadowEvalFlag, Boolean(ctx)),
  };

  try {
    const shadowEval = shadowEvalFlag;

    let mergedEnv: Record<string, unknown> = { ...body.environment };
    let geoBundle: ReturnType<typeof buildGeoEnrichmentBundle> | null = null;
    let geoSnapshotId: string | null = null;

    if (body.skipGeoEnrichment) {
      enrichmentStatus.geo = "skipped";
    } else if (process.env.HEATWISE_GEO_ENRICHMENT === "0") {
      enrichmentStatus.geo = "skipped";
      warnings.push({
        phase: "geo",
        code: "DISABLED_BY_ENV",
        message: "HEATWISE_GEO_ENRICHMENT=0",
      });
    } else {
      try {
        geoBundle = buildGeoEnrichmentBundle(
          body.project,
          mergedEnv,
          body.preferences,
          body.evaluationContext ?? null,
        );
        mergedEnv = mergeGeoIntoEnvironment(mergedEnv, geoBundle);
        enrichmentStatus.geo = "applied";
        const persistGeo = shouldPersistGeoEnrichment();
        if (persistGeo && body.projectId) {
          try {
            geoSnapshotId = await persistGeoEnrichmentChain({ projectId: body.projectId, bundle: geoBundle });
            enrichmentStatus.persistedGeoSnapshot = Boolean(geoSnapshotId);
          } catch (pe) {
            warnings.push({
              phase: "geo",
              code: "PERSIST_FAILED",
              message: errMsg(pe),
            });
          }
        } else if (persistGeo && !body.projectId) {
          warnings.push({
            phase: "geo",
            code: "PERSIST_SKIPPED_NO_PROJECT_ID",
            message: "Geo merge applied in-memory; no projectId to persist snapshot",
          });
        }
      } catch (e) {
        enrichmentStatus.geo = "failed";
        warnings.push({ phase: "geo", code: "ENRICHMENT_ERROR", message: errMsg(e) });
      }
    }

    let requestPayload: RecommendationGenerateRequest = { ...body, environment: mergedEnv };
    let assignment: ReturnType<typeof assignForRequest> | null = null;

    if (body.supplyConstraints) {
      enrichmentStatus.supply = "applied";
      requestPayload = { ...requestPayload, supplyConstraints: body.supplyConstraints };
    } else if (body.skipSupplyConstraints || process.env.HEATWISE_SUPPLY_CONSTRAINTS === "0") {
      enrichmentStatus.supply = "skipped";
      if (process.env.HEATWISE_SUPPLY_CONSTRAINTS === "0") {
        warnings.push({
          phase: "supply",
          code: "DISABLED_BY_ENV",
          message: "HEATWISE_SUPPLY_CONSTRAINTS=0",
        });
      }
    } else {
      try {
        const sc = await buildSupplyConstraintsPayload({
          project: body.project,
          environment: mergedEnv,
          preferences: body.preferences,
          evaluationContext: body.evaluationContext ?? null,
        });
        if (sc) {
          requestPayload = { ...requestPayload, supplyConstraints: sc };
          enrichmentStatus.supply = "applied";
          const persistC = shouldPersistConstraintSnapshot();
          if (persistC && body.projectId) {
            try {
              await persistConstraintSnapshot({ projectId: body.projectId, supply: sc });
              enrichmentStatus.persistedConstraintSnapshot = true;
            } catch (pe) {
              warnings.push({
                phase: "supply",
                code: "PERSIST_FAILED",
                message: errMsg(pe),
              });
            }
          } else if (persistC && !body.projectId) {
            warnings.push({
              phase: "supply",
              code: "PERSIST_SKIPPED_NO_PROJECT_ID",
              message: "Supply constraints applied; no projectId to persist snapshot",
            });
          }
        } else {
          enrichmentStatus.supply = "skipped";
          warnings.push({
            phase: "supply",
            code: "EMPTY_PAYLOAD",
            message: "buildSupplyConstraintsPayload returned null (no DB rows or region)",
          });
        }
      } catch (e) {
        enrichmentStatus.supply = "failed";
        warnings.push({ phase: "supply", code: "ENRICHMENT_ERROR", message: errMsg(e) });
      }
    }

    if (shadowEval && ctx) {
      assignment = assignForRequest({
        assignmentKey,
        experimentId: ctx.experimentId,
        userId: body.userId,
        projectId: body.projectId,
        evaluationContext: ctx,
      });
      const reg = resolveRegistryDirForVariant(assignment.served_variant, body.registryDir ?? null);
      requestPayload = { ...requestPayload, registryDir: reg ?? body.registryDir };
    }

    const t0 = Date.now();
    let out: RecommendationGenerateResponse = await generateRecommendationsRuntime(requestPayload);

    if (geoBundle) {
      out = attachGeoExplanationToCandidates(out, geoBundle.explanation);
    }
    out.telemetryMeta = {
      ...out.telemetryMeta,
      geoEnrichmentSnapshotId: geoSnapshotId ?? undefined,
    };
    out.geoIntelligenceMeta = {
      snapshotId: geoSnapshotId,
      overallConfidence: geoBundle?.overallGeoConfidence ?? null,
      rulesVersion: "hw-geo-rules-v1.0",
    };

    if (body.skipPricingEnrichment) {
      enrichmentStatus.pricing = "skipped";
    } else if (process.env.HEATWISE_PRICING_ENRICHMENT === "0") {
      enrichmentStatus.pricing = "skipped";
      warnings.push({
        phase: "pricing",
        code: "DISABLED_BY_ENV",
        message: "HEATWISE_PRICING_ENRICHMENT=0",
      });
    } else {
      try {
        out = await enrichRecommendationsWithPricing(out, {
          project: body.project,
          environment: mergedEnv,
          preferences: body.preferences,
          evaluationContext: body.evaluationContext ?? null,
          supplyConstraints: requestPayload.supplyConstraints ?? null,
        });
        enrichmentStatus.pricing = "applied";
      } catch (e) {
        enrichmentStatus.pricing = "failed";
        warnings.push({ phase: "pricing", code: "ENRICHMENT_ERROR", message: errMsg(e) });
      }
    }

    out.enrichmentWarnings = warnings;
    out.enrichmentStatus = enrichmentStatus;
    const enrichMeta = buildEnrichmentResponseMeta(enrichmentStatus, warnings);
    out.enrichmentDegraded = enrichMeta.enrichmentDegraded;
    out.enrichmentPartialSuccess = enrichMeta.enrichmentPartialSuccess;

    const primaryLatency = Date.now() - t0;

    if (
      shadowEval &&
      assignment &&
      assignment.evaluation_mode === "shadow" &&
      assignment.assigned_variant !== assignment.served_variant
    ) {
      const shadowReg = resolveRegistryDirForVariant(assignment.assigned_variant, body.registryDir ?? null);
      const shadowBody: RecommendationGenerateRequest = {
        ...requestPayload,
        registryDir: shadowReg ?? body.registryDir,
      };
      const t1 = Date.now();
      let shadowOut: RecommendationGenerateResponse | null = null;
      try {
        shadowOut = await generateRecommendationsRuntime(shadowBody);
      } catch (e) {
        shadowOut = null;
        const shadowErr = errMsg(e);
        out.enrichmentWarnings = [
          ...(out.enrichmentWarnings ?? []),
          {
            phase: "shadow_eval",
            code: "SHADOW_RUNTIME_FAILED",
            message: shadowErr,
          },
        ];
      }
      const shadowLatency = Date.now() - t1;
      const summary = evaluatePrimaryVsShadow(out, shadowOut, {
        experimentId: assignment.experiment_id,
        assignment,
        primaryLatencyMs: primaryLatency,
        shadowLatencyMs: shadowOut ? shadowLatency : null,
      });
      try {
        appendRuntimeEvaluation(summary);
      } catch (e) {
        out.enrichmentWarnings = [
          ...(out.enrichmentWarnings ?? []),
          {
            phase: "shadow_eval",
            code: "EVAL_APPEND_FAILED",
            message: errMsg(e),
          },
        ];
      }
      const shadowMeta = buildEnrichmentResponseMeta(enrichmentStatus, out.enrichmentWarnings ?? []);
      out.enrichmentDegraded = shadowMeta.enrichmentDegraded;
      out.enrichmentPartialSuccess = shadowMeta.enrichmentPartialSuccess;
    }

    const layoutEligibility = getLayoutEligibility(body);
    let layoutGeneration: LayoutGenerationAttachment | undefined;
    let layoutSlate: LayoutSlateMeta;

    if (!layoutEligibility.eligible) {
      layoutSlate = {
        eligible: false,
        status: "skipped_ineligible",
        ineligibleReason: layoutEligibility.ineligibleReason,
      };
    } else {
      const projectInput = layoutEligibility.projectInput!;
      let attached = false;
      let lastLayoutErr: unknown = null;

      for (let attempt = 0; attempt < 2 && !attached; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 50));
          }
          const layoutOrch = await orchestrateLayoutRecommendations({
            input: projectInput,
            projectId: body.projectId ?? null,
            photoSessionId: typeof body.photoSessionId === "string" ? body.photoSessionId : null,
            precomputedMlResult: out,
            persistLayoutRun: true,
          });
          if (layoutOrch.enrichedRecommendations.length === 0) {
            lastLayoutErr = new Error("EMPTY_LAYOUT_RECOMMENDATIONS");
            continue;
          }
          layoutGeneration = {
            recommendations: layoutOrch.enrichedRecommendations,
            durationMs: layoutOrch.durationMs,
            totalCandidates: layoutOrch.totalCandidates,
            mlTelemetryMeta: out.telemetryMeta ?? null,
            mlMode: out.mode ?? null,
          };
          attached = true;
        } catch (le) {
          lastLayoutErr = le;
        }
      }

      if (attached) {
        layoutSlate = { eligible: true, status: "attached" };
      } else {
        const msg = errMsg(lastLayoutErr);
        const code =
          lastLayoutErr instanceof Error && lastLayoutErr.message === "EMPTY_LAYOUT_RECOMMENDATIONS"
            ? "EMPTY_LAYOUT_RECOMMENDATIONS"
            : "LAYOUT_ORCHESTRATION_FAILED";
        out.enrichmentWarnings = [
          ...(out.enrichmentWarnings ?? []),
          {
            phase: "layout",
            code,
            message: msg,
          },
        ];
        const layoutMeta = buildEnrichmentResponseMeta(enrichmentStatus, out.enrichmentWarnings ?? []);
        out.enrichmentDegraded = layoutMeta.enrichmentDegraded;
        out.enrichmentPartialSuccess = layoutMeta.enrichmentPartialSuccess;
        layoutSlate = {
          eligible: true,
          status: "failed",
          failureCode: code,
          failureMessage: msg,
        };
      }
    }

    const outWithLayout: RecommendationGenerateResponse = {
      ...out,
      layoutSlate,
      ...(layoutGeneration ? { layoutGeneration } : {}),
    };

    const obsPayload = buildRecommendationRuntimeObservationPayload(
      outWithLayout,
      layoutSlate,
      layoutGeneration,
      body.projectId,
      observationMeta,
    );
    scheduleRecommendationRuntimeObservation(obsPayload);
    if (process.env.HEATWISE_RUNTIME_LOG_JSON === "1") {
      console.info(
        JSON.stringify({
          type: "heatwise_recommendation_runtime_v1",
          ...obsPayload,
        }),
      );
    }

    const demo = typeof req.query.demo === "string" && req.query.demo === "1";
    return res.status(200).json({
      ...outWithLayout,
      ...(demo ? { demoPresentation: buildDemoRecommendationPresentation(outWithLayout) } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "runtime_error";
    scheduleRecommendationRuntimeObservation(
      buildHandlerErrorObservationPayload({
        projectId: body.projectId,
        errorCode: "RUNTIME_ERROR",
        message: msg,
        meta: observationMeta,
      }),
    );
    return sendStructuredError(res, { code: "RUNTIME_ERROR", message: msg }, 500);
  }
}
