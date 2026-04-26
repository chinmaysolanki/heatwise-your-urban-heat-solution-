import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import { assignInstallersToQuoteRequest } from "@/lib/services/installerAssignmentService";

import { readJsonBody, sendStructuredError } from "./_utils";

type Body = {
  quoteRequestId: string;
  installerIds: string[];
  matchContext: {
    region: string;
    projectType?: string;
    solutionType?: string;
    budgetBand?: string;
    areaSqft?: number;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<Body>(req.body);
  if (!body?.quoteRequestId || !Array.isArray(body.installerIds) || !body.matchContext?.region) {
    return sendStructuredError(
      res,
      { code: "INVALID_BODY", message: "quoteRequestId, installerIds[], matchContext.region required" },
      400,
    );
  }

  const out = await assignInstallersToQuoteRequest(body.quoteRequestId, body.installerIds, body.matchContext);
  if (!out.ok) {
    return sendStructuredError(res, out.error, 400);
  }
  return res.status(200).json({ ok: true });
}
