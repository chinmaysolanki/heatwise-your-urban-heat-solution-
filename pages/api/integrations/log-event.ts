import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import type { LogIntegrationEventInput } from "@/lib/integrationTypes";
import { logIntegrationEvent } from "@/lib/services/integrationEventService";

import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<LogIntegrationEventInput>(req.body);
  if (!body?.eventType || !body.domain) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "eventType and domain required" }, 400);
  }

  const out = await logIntegrationEvent(body);
  if (!out.ok) {
    return sendStructuredError(res, out.error, 400);
  }
  return res.status(201).json({ integrationEventId: out.integrationEventId });
}
