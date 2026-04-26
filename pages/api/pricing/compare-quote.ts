import type { NextApiRequest, NextApiResponse } from "next";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { hasValidOpsToken, requireOpsOrAdmin } from "@/lib/opsAuth";
import {
  buildQuoteComparisonDiagnostics,
  persistQuoteComparisonRecord,
} from "@/lib/services/quoteComparisonService";

import { readJsonBody, sendStructuredError } from "../recommendations/_utils";

type Body = {
  predictedInstallMedianInr?: number | null;
  quotedInstallCostInr?: number | null;
  finalInstallCostInr?: number | null;
  predictedAnnualMaintMedianInr?: number | null;
  actualAnnualMaintInr?: number | null;
  projectId?: string;
  recommendationSessionId?: string | null;
  candidateSnapshotId?: string | null;
  installerQuoteId?: string | null;
  installJobId?: string | null;
  costEstimateId?: string | null;
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
  if (!body) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "JSON body required" }, 400);
  }

  const diagnostics = buildQuoteComparisonDiagnostics({
    predictedInstallMedianInr: body.predictedInstallMedianInr ?? null,
    quotedInstallCostInr: body.quotedInstallCostInr ?? null,
    finalInstallCostInr: body.finalInstallCostInr ?? null,
    predictedAnnualMaintMedianInr: body.predictedAnnualMaintMedianInr ?? null,
    actualAnnualMaintInr: body.actualAnnualMaintInr ?? null,
  });

  let recordId: string | null = null;
  if (body.persist && body.projectId) {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;
    const row = await persistQuoteComparisonRecord({
      project: { connect: { id: body.projectId } },
      session: body.recommendationSessionId ? { connect: { id: body.recommendationSessionId } } : undefined,
      candidateSnapshot: body.candidateSnapshotId
        ? { connect: { id: body.candidateSnapshotId } }
        : undefined,
      installerQuote: body.installerQuoteId ? { connect: { id: body.installerQuoteId } } : undefined,
      installJob: body.installJobId ? { connect: { id: body.installJobId } } : undefined,
      costEstimate: body.costEstimateId ? { connect: { id: body.costEstimateId } } : undefined,
      predictedInstallCostMedianInr: body.predictedInstallMedianInr ?? undefined,
      quotedInstallCostInr: body.quotedInstallCostInr ?? undefined,
      finalInstallCostInr: body.finalInstallCostInr ?? undefined,
      installCostErrorAbsInr: diagnostics.installCostErrorAbsInr ?? undefined,
      installCostErrorPct: diagnostics.installCostErrorPct ?? undefined,
      quoteToFinalDeltaInr: diagnostics.quoteToFinalDeltaInr ?? undefined,
      quoteToFinalDeltaPct: diagnostics.quoteToFinalDeltaPct ?? undefined,
      pricingAccuracyBand: diagnostics.pricingAccuracyBand,
      costRiskFlagsJson: JSON.stringify(diagnostics.flags),
      notes: diagnostics.predictedVsActualNote ?? diagnostics.quoteAlignmentNote ?? undefined,
    });
    recordId = row.id;
  }

  return res.status(200).json({ diagnostics, recordId });
}
