import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import type { IngestWebhookInput } from "@/lib/integrationTypes";
import { ingestInboundWebhook } from "@/lib/services/webhookIngestionService";

import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<IngestWebhookInput>(req.body);
  if (!body?.sourceSystem || !body.eventType) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "sourceSystem and eventType required" }, 400);
  }

  const out = await ingestInboundWebhook(body);
  if (!out.ok) {
    return sendStructuredError(res, out.error, 400);
  }
  if (out.duplicate) {
    return res.status(200).json({ inboundWebhookId: out.inboundWebhookId, duplicate: true });
  }
  return res.status(201).json({
    inboundWebhookId: out.inboundWebhookId,
    duplicate: false,
    validationStatus: out.validationStatus,
  });
}
