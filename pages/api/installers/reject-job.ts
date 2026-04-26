import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import { cancelInstallJob, declineQuoteAssignment } from "@/lib/services/installExecutionService";

import { readJsonBody, sendStructuredError } from "./_utils";

type Body =
  | { quoteAssignmentId: string; reasonCodes: string[] }
  | { installJobId: string; reason: string; reasonCodes?: string[] };

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<Body>(req.body);
  if (!body) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "Invalid JSON" }, 400);
  }

  if ("quoteAssignmentId" in body && body.quoteAssignmentId) {
    const out = await declineQuoteAssignment(body.quoteAssignmentId, body.reasonCodes);
    if (!out.ok) return sendStructuredError(res, out.error, 400);
    return res.status(200).json({ ok: true, kind: "assignment_declined" });
  }

  if ("installJobId" in body && body.installJobId) {
    const out = await cancelInstallJob(body.installJobId, body.reason, body.reasonCodes);
    if (!out.ok) return sendStructuredError(res, out.error, 400);
    return res.status(200).json({ ok: true, kind: "job_cancelled" });
  }

  return sendStructuredError(
    res,
    { code: "INVALID_BODY", message: "quoteAssignmentId or installJobId required" },
    400,
  );
}
