import type { ProjectInput, Recommendation } from "@/models";
import type { RecommendationGenerateResponse } from "@/lib/ml/recommendationRuntimeTypes";
import {
  runPipeline,
  mapLayoutToSpatialAnchors,
  buildHeatReductionSummary,
} from "@/recommendation-engine";
import { db } from "@/lib/db";
import { mergeMlIntoLayoutRecommendations } from "@/lib/recommendation/mergeMlIntoLayoutRecommendations";
import { projectInputToMlRequest } from "@/lib/recommendation/projectInputToMlRequest";
import { generateRecommendationsRuntime } from "@/lib/services/mlRecommendationService";
import { buildCatalogHybridFallback } from "@/lib/recommendation/catalogHybridFallback";
import type { GenerateLayoutHttpResponse } from "@/lib/recommendation/recommendationLayoutDto";
import { resolveRecommendationRunLinkages } from "@/lib/recommendation/resolveRecommendationRunLinkages";
import { resolveSpeciesIdentity } from "@/lib/species/resolveSpeciesCatalogCode";

/** Skip a second persist when the same layout input was just written (fallback after canonical). */
const LAYOUT_RUN_DEDUPE_MS = 180_000;

function stableProjectInputJson(input: ProjectInput): string {
  const o = input as unknown as Record<string, unknown>;
  const norm: Record<string, unknown> = {};
  for (const k of Object.keys(o).sort()) {
    const v = o[k];
    if (v !== undefined) norm[k] = v;
  }
  return JSON.stringify(norm);
}

export type OrchestrateLayoutRecommendationsOptions = {
  input: ProjectInput;
  projectId?: string | null;
  photoSessionId?: string | null;
  /**
   * When set, skips calling Python/ML again (use the enriched response from the canonical generate path).
   */
  precomputedMlResult?: RecommendationGenerateResponse | null;
  /**
   * When true (default), persists RecommendationRun + RecommendationCandidate after layout (awaited).
   * Dedupes by stable input fingerprint + photoSessionId/projectId within a short window to avoid double writes when clients hit the legacy layout route after canonical.
   */
  persistLayoutRun?: boolean;
};

export type OrchestrateLayoutRecommendationsResult = {
  enrichedRecommendations: Recommendation[];
  durationMs: number;
  totalCandidates: number;
  mlResult: RecommendationGenerateResponse | null;
};

function isTsMlFallback(ml: RecommendationGenerateResponse | null): boolean {
  if (!ml) return true;
  return (ml.telemetryMeta.mlErrors ?? []).some((e) =>
    String(e).includes("python_runtime_unavailable_ts_fallback"),
  );
}

async function persistRecommendationRunIfNeeded(params: {
  input: ProjectInput;
  enrichedRecommendations: Recommendation[];
  durationMs: number;
  totalCandidates: number;
  projectId?: string | null;
  photoSessionId?: string | null;
}): Promise<void> {
  const { input, enrichedRecommendations, durationMs, totalCandidates, projectId, photoSessionId } = params;
  try {
    const inputJson = stableProjectInputJson(input);
    const since = new Date(Date.now() - LAYOUT_RUN_DEDUPE_MS);

    if (typeof photoSessionId === "string" && photoSessionId.length > 0) {
      const dup = await db.recommendationRun.findFirst({
        where: {
          photoSessionId,
          input: inputJson,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (dup) {
        console.info(
          "[orchestrateLayoutRecommendations] Skipping duplicate RecommendationRun (same photoSession + input fingerprint)",
        );
        return;
      }
    } else if (typeof projectId === "string" && projectId.length > 0) {
      const dup = await db.recommendationRun.findFirst({
        where: {
          projectId,
          photoSessionId: null,
          input: inputJson,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (dup) {
        console.info(
          "[orchestrateLayoutRecommendations] Skipping duplicate RecommendationRun (same project + input fingerprint)",
        );
        return;
      }
    }

    const link = await resolveRecommendationRunLinkages({ projectId, photoSessionId });

    const codes = enrichedRecommendations
      .map(
        (r) =>
          r.primarySpeciesIdentity?.catalogCode ??
          r.candidate?.scoredPlants?.[0]?.plant?.speciesCatalogCode ??
          null,
      )
      .filter((c): c is string => Boolean(c));
    const uniqueCodes = [...new Set(codes)];
    const catalogRows =
      uniqueCodes.length > 0
        ? await db.speciesCatalog.findMany({
            where: { code: { in: uniqueCodes } },
            select: { id: true, code: true },
          })
        : [];
    const codeToSpeciesId = new Map(catalogRows.map((row) => [row.code, row.id]));

    const candidateCreates = enrichedRecommendations.map((rec, index) => {
      const speciesCatalogCode =
        rec.primarySpeciesIdentity?.catalogCode ??
        rec.candidate?.scoredPlants?.[0]?.plant?.speciesCatalogCode ??
        null;
      const speciesId = speciesCatalogCode ? codeToSpeciesId.get(speciesCatalogCode) ?? null : null;
      return {
        rank: rec.rank ?? index + 1,
        recommendationId:
          (rec as { id?: string }).id ??
          rec.candidate?.template?.id ??
          rec.candidate?.template?.name ??
          `rank-${index + 1}`,
        layoutName: rec.candidate?.template?.name ?? "Unknown Layout",
        headline: rec.explanation?.headline ?? null,
        summary: rec.explanation?.summary ?? null,
        costEstimate: JSON.stringify(rec.candidate?.costEstimate ?? {}),
        heatEstimate: JSON.stringify(rec.candidate?.heatEstimate ?? {}),
        layoutSchema: JSON.stringify(rec.layoutSchema),
        spatialMapping: (rec as Recommendation & { spatialMapping?: unknown }).spatialMapping
          ? JSON.stringify((rec as Recommendation & { spatialMapping?: unknown }).spatialMapping)
          : null,
        heatReductionSummary: (rec as Recommendation & { heatReductionSummary?: unknown })
          .heatReductionSummary
          ? JSON.stringify(
              (rec as Recommendation & { heatReductionSummary?: unknown }).heatReductionSummary,
            )
          : null,
        speciesId,
        speciesCatalogCode,
      };
    });

    const run = await db.recommendationRun.create({
      data: {
        input: inputJson,
        durationMs,
        totalCandidates,
        projectId: typeof projectId === "string" ? projectId : null,
        photoSessionId: typeof photoSessionId === "string" ? photoSessionId : null,
        spaceId: link.spaceId,
        environmentSnapshotId: link.environmentSnapshotId,
        userPreferenceId: link.userPreferenceId,
        candidates: { create: candidateCreates },
      },
      include: { candidates: true },
    });

    if (run.photoSessionId && run.candidates.length > 0) {
      const top = run.candidates.reduce(
        (best: { rank: number }, c: { rank: number }) => (c.rank < best.rank ? c : best),
        run.candidates[0] as { rank: number },
      );
      await db.photoSession.update({
        where: { id: run.photoSessionId },
        data: { selectedCandidateId: (top as { id?: string }).id },
      });
    }
  } catch (e) {
    console.error("[orchestrateLayoutRecommendations] Failed to persist run/candidates", e);
  }
}

/**
 * Shared server orchestration: ML runtime (or reuse precomputed) + TS layout pipeline + merge + spatial/heat enrichment.
 */
export async function orchestrateLayoutRecommendations(
  opts: OrchestrateLayoutRecommendationsOptions,
): Promise<OrchestrateLayoutRecommendationsResult> {
  const {
    input,
    projectId,
    photoSessionId,
    precomputedMlResult,
    persistLayoutRun = true,
  } = opts;

  let mlResult: RecommendationGenerateResponse | null = null;
  if (precomputedMlResult != null) {
    mlResult = precomputedMlResult;
  } else {
    const mlReq = projectInputToMlRequest(input, {
      projectId: projectId ?? null,
      maxCandidates: 8,
    });
    try {
      mlResult = await generateRecommendationsRuntime(mlReq);
    } catch (e) {
      console.warn("[orchestrateLayoutRecommendations] ML runtime threw; using catalog hybrid", e);
      try {
        mlResult = await buildCatalogHybridFallback(mlReq, { stderr: String(e) });
      } catch (inner) {
        console.warn("[orchestrateLayoutRecommendations] catalog hybrid failed, layout-only", inner);
        mlResult = null;
      }
    }
  }

  const pipelineResult = runPipeline(input, { topN: 3 });
  let recommendationsForResponse = pipelineResult.recommendations;
  const tsFallbackOnly = isTsMlFallback(mlResult);
  if (mlResult && recommendationsForResponse.length > 0 && !tsFallbackOnly) {
    recommendationsForResponse = mergeMlIntoLayoutRecommendations(
      recommendationsForResponse,
      mlResult,
      input.primaryGoal,
    );
  }

  const enrichedRecommendations = recommendationsForResponse.map((rec: Recommendation) => {
    const layoutSchema = rec.layoutSchema;
    const spatialMapping = mapLayoutToSpatialAnchors(layoutSchema, "top_left");
    const heatReductionSummary = buildHeatReductionSummary(rec, layoutSchema);
    const topPlantId = rec.candidate?.scoredPlants?.[0]?.plant?.id ?? null;
    const primarySpeciesIdentity =
      rec.primarySpeciesIdentity ??
      resolveSpeciesIdentity({ enginePlantId: topPlantId, mlSpeciesLabel: null });
    return {
      ...rec,
      layoutSchema,
      spatialMapping,
      heatReductionSummary,
      primarySpeciesIdentity,
    };
  });

  if (persistLayoutRun) {
    await persistRecommendationRunIfNeeded({
      input,
      enrichedRecommendations,
      durationMs: pipelineResult.durationMs,
      totalCandidates: pipelineResult.totalCandidates,
      projectId,
      photoSessionId,
    });
  }

  return {
    enrichedRecommendations,
    durationMs: pipelineResult.durationMs,
    totalCandidates: pipelineResult.totalCandidates,
    mlResult,
  };
}

/** Maps orchestrator output to the legacy generate-layout HTTP response shape. */
export function toGenerateLayoutHttpResponse(
  result: OrchestrateLayoutRecommendationsResult,
): GenerateLayoutHttpResponse {
  return {
    recommendations: result.enrichedRecommendations,
    durationMs: result.durationMs,
    totalCandidates: result.totalCandidates,
    mlTelemetryMeta: result.mlResult?.telemetryMeta ?? null,
    mlMode: result.mlResult?.mode ?? null,
  };
}
