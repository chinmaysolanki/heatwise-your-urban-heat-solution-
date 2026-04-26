import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import { logLeadFunnelEvent } from "@/lib/services/leadFunnelService";
import type { LogLeadFunnelEventInput } from "@/lib/commercialTypes";

import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<LogLeadFunnelEventInput>(req.body);
  if (!body?.projectId || !body.funnelStage || !body.eventType) {
    return sendStructuredError(
      res,
      { code: "INVALID_BODY", message: "projectId, funnelStage, eventType required" },
      400,
    );
  }

  const out = await logLeadFunnelEvent(body);
  if (!out.ok) {
    return sendStructuredError(res, out.error, 400);
  }
  return res.status(201).json({ leadFunnelEventId: out.leadFunnelEventId });
}
