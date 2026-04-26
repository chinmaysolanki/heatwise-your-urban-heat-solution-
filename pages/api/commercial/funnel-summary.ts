import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import { getFunnelSummary } from "@/lib/services/leadFunnelService";

import { parseIsoDate, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const ws = parseIsoDate(req.query.windowStart as string, "windowStart");
  const we = parseIsoDate(req.query.windowEnd as string, "windowEnd");
  if (!ws || !we || ws >= we) {
    return sendStructuredError(
      res,
      { code: "INVALID_QUERY", message: "windowStart and windowEnd required as ISO dates; start < end" },
      400,
    );
  }

  const region = typeof req.query.region === "string" ? req.query.region : undefined;
  const projectType = typeof req.query.projectType === "string" ? req.query.projectType : undefined;
  const sourceChannel = typeof req.query.sourceChannel === "string" ? req.query.sourceChannel : undefined;
  const budgetBand = typeof req.query.budgetBand === "string" ? req.query.budgetBand : undefined;

  const summary = await getFunnelSummary({
    windowStart: ws,
    windowEnd: we,
    region,
    projectType,
    sourceChannel,
    budgetBand,
  });

  return res.status(200).json(summary);
}
