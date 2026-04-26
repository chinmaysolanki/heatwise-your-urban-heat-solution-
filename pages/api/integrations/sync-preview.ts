import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import type { OutboundSyncPreviewInput } from "@/lib/integrationTypes";
import { previewOutboundSync } from "@/lib/services/outboundSyncService";

import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<OutboundSyncPreviewInput>(req.body);
  if (!body?.targetSystem || !body.entityType || !body.entityId) {
    return sendStructuredError(
      res,
      { code: "INVALID_BODY", message: "targetSystem, entityType, entityId required" },
      400,
    );
  }

  const out = previewOutboundSync(body);
  if (!out.ok) {
    return sendStructuredError(res, out.error, 400);
  }
  return res.status(200).json({ preview: out.preview });
}
