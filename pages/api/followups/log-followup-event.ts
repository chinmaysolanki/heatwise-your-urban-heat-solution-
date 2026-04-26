import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import { logFollowupEvent } from "@/lib/services/followupEventService";

import { readJsonBody, sendStructuredError } from "./_utils";

type Body = {
  checkpointId: string;
  eventType: string;
  qualitativeNote?: string | null;
  metadata?: Record<string, unknown> | null;
  eventAt?: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<Body>(req.body);
  if (!body?.checkpointId || !body.eventType) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "checkpointId and eventType required" }, 400);
  }

  const out = await logFollowupEvent(body);
  if (!out.ok) {
    return sendStructuredError(res, out.error, 400);
  }
  return res.status(201).json({ followupEventId: out.eventId });
}
