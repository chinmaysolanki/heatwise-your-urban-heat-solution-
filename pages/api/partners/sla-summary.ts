import type { NextApiRequest, NextApiResponse } from "next";

import { validationError } from "@/lib/recommendationTelemetryValidation";
import { requireOpsOrAdmin } from "@/lib/opsAuth";
import { getPartnerSLASummary } from "@/lib/services/partnerSLAService";

import { sendStructuredError } from "./_utils";

function parseDate(q: string | string[] | undefined, label: string): Date | null {
  if (!q || Array.isArray(q)) return null;
  const d = new Date(q);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const iid = typeof req.query.installerId === "string" ? req.query.installerId.trim() : "";
  if (!iid) {
    return sendStructuredError(res, { code: "INVALID_QUERY", message: "installerId required" }, 400);
  }

  const ws = parseDate(req.query.windowStart, "windowStart");
  const we = parseDate(req.query.windowEnd, "windowEnd");
  const recompute = req.query.recompute === "1" || req.query.recompute === "true";

  if ((req.query.windowStart && !ws) || (req.query.windowEnd && !we)) {
    return sendStructuredError(res, validationError("INVALID_QUERY", "invalid ISO window date"), 400);
  }

  const out = await getPartnerSLASummary(iid, ws ?? undefined, we ?? undefined, { recompute });
  if (!out.ok) return sendStructuredError(res, out.error, 400);

  return res.status(200).json({
    source: out.source,
    summary: out.summary,
  });
}
