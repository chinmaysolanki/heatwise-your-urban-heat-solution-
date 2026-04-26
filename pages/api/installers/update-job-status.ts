import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import { updateInstallJobStatus } from "@/lib/services/installExecutionService";

import { readJsonBody, sendStructuredError } from "./_utils";

type Body = {
  installJobId: string;
  nextStatus: string;
  scheduledDate?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  finalCostInr?: number | null;
  jobNotes?: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "PATCH" && req.method !== "POST") {
    res.setHeader("Allow", "PATCH, POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "PATCH or POST" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<Body>(req.body);
  if (!body?.installJobId || !body.nextStatus) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "installJobId and nextStatus required" }, 400);
  }

  const out = await updateInstallJobStatus(body.installJobId, body.nextStatus, {
    scheduledDate: body.scheduledDate,
    startedAt: body.startedAt,
    completedAt: body.completedAt,
    finalCostInr: body.finalCostInr,
    jobNotes: body.jobNotes,
  });
  if (!out.ok) {
    return sendStructuredError(res, out.error, 400);
  }
  return res.status(200).json({ ok: true });
}
