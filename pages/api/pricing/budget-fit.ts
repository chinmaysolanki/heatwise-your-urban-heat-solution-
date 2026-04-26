import type { NextApiRequest, NextApiResponse } from "next";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { hasValidOpsToken } from "@/lib/opsAuth";
import type { CostRangeInr, EstimateConfidenceBand, PricingEvalContext } from "@/lib/ml/pricingTypes";
import { assessBudgetFit, persistBudgetFitAssessment } from "@/lib/services/budgetFitService";
import { estimateCandidatePricing } from "@/lib/services/pricingEstimateService";

import { readJsonBody, sendStructuredError } from "../recommendations/_utils";

type Body = {
  userBudgetInr: number;
  project?: Record<string, unknown>;
  environment?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  candidatePayload: Record<string, unknown>;
  evaluationContext?: PricingEvalContext | null;
  estimateConfidenceBand?: EstimateConfidenceBand;
  /** If true, skip re-estimate and use provided install range. */
  installRange?: CostRangeInr;
  projectId?: string;
  candidateSnapshotId?: string | null;
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
  if (!body || typeof body.userBudgetInr !== "number" || !body.candidatePayload) {
    return sendStructuredError(
      res,
      { code: "INVALID_BODY", message: "userBudgetInr and candidatePayload required" },
      400,
    );
  }

  let installRange: CostRangeInr;
  let confidence: EstimateConfidenceBand = body.estimateConfidenceBand ?? "medium";

  if (body.installRange) {
    installRange = body.installRange;
  } else if (body.project != null && body.environment != null && body.preferences != null) {
    const pricing = await estimateCandidatePricing(body.candidatePayload, {
      project: body.project,
      environment: body.environment,
      preferences: body.preferences,
      evaluationContext: body.evaluationContext ?? null,
    });
    installRange = pricing.installCostRange;
    confidence = pricing.estimateConfidenceBand;
  } else {
    return sendStructuredError(
      res,
      { code: "INVALID_BODY", message: "Provide installRange or full project/environment/preferences" },
      400,
    );
  }

  const fit = assessBudgetFit({
    userBudgetInr: body.userBudgetInr,
    installRange,
    estimateConfidenceBand: confidence,
    candidate: body.candidatePayload,
  });

  let assessmentId: string | null = null;
  if (body.persist && body.projectId) {
    const row = await persistBudgetFitAssessment({
      project: { connect: { id: body.projectId } },
      candidateSnapshot: body.candidateSnapshotId
        ? { connect: { id: body.candidateSnapshotId } }
        : undefined,
      userBudgetInr: body.userBudgetInr,
      estimatedInstallCostMedianInr: installRange.median,
      estimatedInstallCostMaxInr: installRange.max,
      budgetFitBand: fit.budgetFitBand,
      budgetFitScore: fit.budgetFitScore,
      stretchBudgetRequired: fit.stretchBudgetRequired,
      affordabilityRiskLevel: fit.affordabilityRiskLevel,
      downgradeSuggestionJson: fit.downgradeSuggestionJson ?? undefined,
      budgetFitReason: fit.budgetFitReason,
      cheaperAlternativesJson: fit.cheaperAlternativesJson,
      phasedInstallOptionJson: fit.phasedInstallOptionJson ?? undefined,
    });
    assessmentId = row.id;
  }

  return res.status(200).json({ ...fit, installRange, assessmentId });
}
