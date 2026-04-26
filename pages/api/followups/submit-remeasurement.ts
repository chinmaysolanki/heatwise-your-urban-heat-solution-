import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import { submitRemeasurement } from "@/lib/services/remeasurementService";

import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<Parameters<typeof submitRemeasurement>[0]>(req.body);
  if (!body?.projectId || !body.windowLabel) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "projectId and windowLabel required" }, 400);
  }

  const out = await submitRemeasurement(body);
  if (!out.ok) {
    return sendStructuredError(res, out.error, 400);
  }
  return res.status(201).json({ remeasurementId: out.remeasurementId });
}
