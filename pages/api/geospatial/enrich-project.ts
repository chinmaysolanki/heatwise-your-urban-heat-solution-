import type { NextApiRequest, NextApiResponse } from "next";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { hasValidOpsToken } from "@/lib/opsAuth";
import type { RecommendationEvaluationContext } from "@/lib/ml/recommendationRuntimeTypes";
import {
  buildGeoEnrichmentBundle,
  mergeGeoIntoEnvironment,
  persistGeoEnrichmentChain,
} from "@/lib/services/geoEnrichmentService";

import { readJsonBody, sendStructuredError } from "../recommendations/_utils";

type Body = {
  project: Record<string, unknown>;
  environment: Record<string, unknown>;
  preferences: Record<string, unknown>;
  evaluationContext?: RecommendationEvaluationContext | null;
  projectId?: string;
  persist?: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const session = await getServerSession(req, res, authOptions as NextAuthOptions);
  if (!session && !hasValidOpsToken(req)) {
    return sendStructuredError(res, { code: "UNAUTHORIZED", message: "Session or ops token required" }, 401);
  }

  const body = readJsonBody<Body>(req.body);
  if (!body?.project || !body.environment || !body.preferences) {
    return sendStructuredError(
      res,
      { code: "INVALID_BODY", message: "project, environment, preferences required" },
      400,
    );
  }

  try {
    const bundle = buildGeoEnrichmentBundle(
      body.project,
      body.environment,
      body.preferences,
      body.evaluationContext ?? null,
    );
    const mergedEnvironment = mergeGeoIntoEnvironment({ ...body.environment }, bundle);
    let snapshotId: string | null = null;
    if (body.persist && body.projectId) {
      snapshotId = await persistGeoEnrichmentChain({ projectId: body.projectId, bundle });
    }
    return res.status(200).json({ bundle, mergedEnvironment, snapshotId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "geo_enrich_failed";
    return sendStructuredError(res, { code: "GEO_ENRICH_ERROR", message: msg }, 500);
  }
}
