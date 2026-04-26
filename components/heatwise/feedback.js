import {
  buildRecommendationGenerateRequestFromPhotoSession,
  buildGenerateLayoutRequestBody,
  layoutRecommendationsFromGenerateResponse,
} from "@/lib/recommendation/buildRecommendationGenerateRequestFromPhotoSession";
import { extractSpeciesCatalogCodesFromRecommendation } from "@/lib/recommendation/buildTelemetrySpeciesPayload";

export const fetchHeatReductionSummary = async () => {
  try {
    const base = buildRecommendationGenerateRequestFromPhotoSession({
      widthM: 6,
      lengthM: 7,
      floorLevel: 5,
      projectMeta: { surfaceType: "rooftop", primaryGoal: "cooling" },
      environment: { sunExposure: "full", windLevel: "medium" },
    });
    let res = await fetch("/api/recommendations/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...base,
        skipGeoEnrichment: true,
        skipSupplyConstraints: true,
        skipPricingEnrichment: true,
      }),
    });
    let data = null;
    try {
      data = res.ok ? await res.json() : null;
    } catch {
      data = null;
    }
    let recs = layoutRecommendationsFromGenerateResponse(data);
    if (!recs.length) {
      res = await fetch("/api/generate-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildGenerateLayoutRequestBody({
            widthM: 6,
            lengthM: 7,
            floorLevel: 5,
            projectMeta: { surfaceType: "rooftop", primaryGoal: "cooling" },
            environment: { sunExposure: "full", windLevel: "medium" },
          }),
        ),
      });
      try {
        data = res.ok ? await res.json() : null;
      } catch {
        data = null;
      }
      recs = Array.isArray(data?.recommendations) ? data.recommendations : [];
    }
    const rec = recs[0];
    return rec?.heatReductionSummary ?? null;
  } catch {
    return null;
  }
};

export const logRecommendationFeedback = (action, payload = {}) => {
  try {
    const { recommendation, projectId, scoreBefore, scoreAfter, extra } = payload;

    const recommendationId =
      recommendation?.id ||
      recommendation?.candidate?.template?.id ||
      recommendation?.candidate?.template?.name ||
      "unknown-recommendation";

    const finalProjectId =
      projectId || recommendation?.candidate?.template?.id || undefined;

    const rank = recommendation?.rank;

    const speciesCatalogCodes = recommendation
      ? extractSpeciesCatalogCodesFromRecommendation(recommendation)
      : [];

    fetch("/api/recommendation-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        recommendationId,
        projectId: finalProjectId,
        action,
        timestamp: new Date().toISOString(),
        scoreBefore,
        scoreAfter,
        extra: {
          ...(extra || {}),
          rank,
          ...(speciesCatalogCodes.length ? { speciesCatalogCodes } : {}),
        },
      }),
    }).catch(() => {});
  } catch {
    // swallow
  }
};
