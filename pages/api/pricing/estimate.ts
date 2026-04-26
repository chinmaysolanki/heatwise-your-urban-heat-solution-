import type { NextApiRequest, NextApiResponse } from "next";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { hasValidOpsToken } from "@/lib/opsAuth";
import type { RecommendationEvaluationContext } from "@/lib/ml/recommendationRuntimeTypes";
import type { PricingContextInput, PricingEvalContext } from "@/lib/ml/pricingTypes";
import type { SupplyConstraintsPayloadV1 } from "@/lib/ml/supplyConstraintTypes";
import { estimateCandidatePricing } from "@/lib/services/pricingEstimateService";
import { buildSupplyConstraintsPayload } from "@/lib/services/recommendationConstraintService";

import { readJsonBody, sendStructuredError } from "../recommendations/_utils";

type Body = {
  project: Record<string, unknown>;
  environment: Record<string, unknown>;
  preferences: Record<string, unknown>;
  candidatePayload?: Record<string, unknown>;
  evaluationContext?: PricingEvalContext | null;
  useSupplyFromDb?: boolean;
  useQuoteBenchmark?: boolean;
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

  let supply: SupplyConstraintsPayloadV1 | null | undefined = undefined;
  if (body.useSupplyFromDb) {
    try {
      supply =
        (await buildSupplyConstraintsPayload({
          project: body.project,
          environment: body.environment,
          preferences: body.preferences,
          evaluationContext: body.evaluationContext as RecommendationEvaluationContext | null,
        })) ?? null;
    } catch {
      supply = null;
    }
  }

  const ctx: PricingContextInput = {
    project: body.project,
    environment: body.environment,
    preferences: body.preferences,
    evaluationContext: body.evaluationContext ?? null,
    supplyConstraints: supply ?? undefined,
  };

  const cand = body.candidatePayload ?? {
    recommendation_type: "planter",
    greenery_density: "medium",
    planter_type: "raised",
    irrigation_type: "drip",
    shade_solution: "pergola",
  };

  let bench: number | null = null;
  if (body.useQuoteBenchmark) {
    const { medianQuotedAmountForRegion } = await import("@/lib/services/quoteComparisonService");
    const { resolveSupplyRegion } = await import("@/lib/services/recommendationConstraintService");
    const region = resolveSupplyRegion(body.project, body.environment, body.evaluationContext as never);
    if (region) {
      try {
        bench = await medianQuotedAmountForRegion(region);
      } catch {
        bench = null;
      }
    }
  }

  const pricing = await estimateCandidatePricing(cand, ctx, { benchmarkMedianInr: bench });
  return res.status(200).json({ pricing, candidatePayload: cand });
}
