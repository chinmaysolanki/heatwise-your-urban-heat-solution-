import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import { acceptQuoteAndCreateJob } from "@/lib/services/installExecutionService";

import { readJsonBody, sendStructuredError } from "./_utils";

type Body = { installerQuoteId: string; installPlan: Record<string, unknown> };

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<Body>(req.body);
  if (!body?.installerQuoteId) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "installerQuoteId required" }, 400);
  }

  const out = await acceptQuoteAndCreateJob(body.installerQuoteId, body.installPlan ?? {});
  if (!out.ok) {
    return sendStructuredError(res, out.error, 400);
  }
  return res.status(201).json({ installJobId: out.installJobId });
}
