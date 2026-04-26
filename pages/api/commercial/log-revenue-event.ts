import type { NextApiRequest, NextApiResponse } from "next";

import { readIdempotencyKey } from "@/lib/httpIdempotency";
import { requireOpsOrAdmin } from "@/lib/opsAuth";
import { logRevenueEvent } from "@/lib/services/revenueEventService";
import type { LogRevenueEventInput } from "@/lib/commercialTypes";

import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const raw = readJsonBody<LogRevenueEventInput>(req.body);
  if (!raw?.eventType || !raw.revenueStatus || !raw.revenueSource) {
    return sendStructuredError(
      res,
      { code: "INVALID_BODY", message: "eventType, revenueStatus, revenueSource required" },
      400,
    );
  }

  const idem = readIdempotencyKey(req, raw);
  const out = await logRevenueEvent({ ...raw, idempotencyKey: idem });
  if (!out.ok) {
    const st =
      out.error.code === "IDEMPOTENCY_IN_FLIGHT" || out.error.code === "IDEMPOTENCY_CONFLICT" ? 409 : 400;
    return sendStructuredError(res, out.error, st);
  }
  if (out.idempotency?.replayed) res.setHeader("x-heatwise-idempotency-replayed", "1");
  if (out.idempotency?.scope) res.setHeader("x-heatwise-idempotency-scope", out.idempotency.scope);
  return res.status(201).json({
    revenueEventId: out.revenueEventId,
    ...(out.idempotency ? { idempotency: out.idempotency } : {}),
  });
}
