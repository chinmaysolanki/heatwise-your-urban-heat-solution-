import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import {
  computeInstallerCommercialMetrics,
  persistInstallerCommercialSnapshots,
} from "@/lib/services/installerCommercialService";

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

  const installerId = typeof req.query.installerId === "string" ? req.query.installerId : undefined;
  const region = typeof req.query.region === "string" ? req.query.region : undefined;
  const persist = req.query.persist === "1" || req.query.persist === "true";

  const filters = { windowStart: ws, windowEnd: we, installerId, region };
  let rows = await computeInstallerCommercialMetrics(filters);
  if (installerId) {
    rows = rows.filter((r) => r.installerId === installerId);
  }

  let persistedCount: number | undefined;
  if (persist) {
    const p = await persistInstallerCommercialSnapshots(filters);
    persistedCount = p.count;
  }

  return res.status(200).json({
    window: { startIso: ws.toISOString(), endIso: we.toISOString() },
    filters: { installerId, region },
    installers: rows,
    persistedCount,
  });
}
