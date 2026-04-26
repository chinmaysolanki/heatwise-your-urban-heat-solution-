import type { NextApiRequest, NextApiResponse } from "next";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { hasValidOpsToken } from "@/lib/opsAuth";
import type { RecommendationEvaluationContext } from "@/lib/ml/recommendationRuntimeTypes";
import { computeGeoContext } from "@/lib/services/geoContextService";
import { computeMicroclimate } from "@/lib/services/microclimateService";

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

  const geo = computeGeoContext(body.project, body.environment, body.evaluationContext ?? null);
  const micro = computeMicroclimate(body.project, body.environment, body.preferences, geo);
  return res.status(200).json({ geoContext: geo, microclimate: micro });
}
