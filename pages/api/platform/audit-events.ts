import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import type { AppendAuditEventInput } from "@/lib/platformHardeningTypes";
import { appendPlatformAuditEvent, listRecentPlatformAuditEvents } from "@/lib/services/auditEventService";

import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method === "GET") {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;
    const raw = req.query.limit;
    const limit = typeof raw === "string" ? Number.parseInt(raw, 10) : 20;
    const rows = await listRecentPlatformAuditEvents(Number.isFinite(limit) ? limit : 20);
    return res.status(200).json({ items: rows });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET or POST" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<AppendAuditEventInput>(req.body);
  if (!body?.auditEventType || !body.subsystem || !body.actorType || !body.action || !body.outcome) {
    return sendStructuredError(
      res,
      { code: "INVALID_BODY", message: "auditEventType, subsystem, actorType, action, outcome required" },
      400,
    );
  }

  const out = await appendPlatformAuditEvent(body);
  if (!out.ok) {
    return sendStructuredError(res, out.error, 400);
  }
  return res.status(201).json({ platformAuditEventId: out.platformAuditEventId });
}
