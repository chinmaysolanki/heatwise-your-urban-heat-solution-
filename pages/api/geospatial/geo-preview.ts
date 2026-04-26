import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import type { RecommendationEvaluationContext } from "@/lib/ml/recommendationRuntimeTypes";
import { buildGeoEnrichmentBundle, mergeGeoIntoEnvironment } from "@/lib/services/geoEnrichmentService";

import { readJsonBody, sendStructuredError } from "../recommendations/_utils";

type Body = {
  project: Record<string, unknown>;
  environment: Record<string, unknown>;
  preferences: Record<string, unknown>;
  evaluationContext?: RecommendationEvaluationContext | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<Body>(req.body);
  if (!body?.project || !body.environment || !body.preferences) {
    return sendStructuredError(
      res,
      { code: "INVALID_BODY", message: "project, environment, preferences required" },
      400,
    );
  }

  const bundle = buildGeoEnrichmentBundle(
    body.project,
    body.environment,
    body.preferences,
    body.evaluationContext ?? null,
  );
  const mergedEnvironment = mergeGeoIntoEnvironment({ ...body.environment }, bundle);

  return res.status(200).json({
    rulesVersion: "hw-geo-rules-v1.0",
    bundle,
    mergedEnvironmentKeys: Object.keys(mergedEnvironment).filter((k) => k.startsWith("geo_")),
    notes: [
      "Geo keys are merged into runtime ``environment`` for ML row merge + Python geo_adjustments.",
      "Set HEATWISE_PERSIST_GEO_ENRICHMENT=1 on generate to persist GeoEnrichmentSnapshot chain.",
    ],
  });
}
