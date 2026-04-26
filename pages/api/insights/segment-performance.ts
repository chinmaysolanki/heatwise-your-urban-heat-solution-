import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import {
  computeSegmentPerformance,
  persistSegmentPerformanceSnapshot,
  validateSegmentFilterKey,
} from "@/lib/services/segmentPerformanceService";

import { parseWindow, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const win = parseWindow(req);
  if (!win) {
    return sendStructuredError(
      res,
      { code: "INVALID_QUERY", message: "windowStart and windowEnd ISO required; start < end" },
      400,
    );
  }

  const dimKey = typeof req.query.dimensionKey === "string" ? req.query.dimensionKey : null;
  if (dimKey) {
    const vk = validateSegmentFilterKey(dimKey);
    if (!vk.ok) {
      return sendStructuredError(res, vk.error, 400);
    }
  }

  const computed = await computeSegmentPerformance(win);

  let filtered = computed.segments;
  const dimVal = typeof req.query.dimensionValue === "string" ? req.query.dimensionValue : null;
  if (dimKey && dimVal) {
    const k = dimKey as keyof (typeof filtered)[0];
    filtered = filtered.filter((s) => String((s as never)[k] ?? "") === dimVal);
  }

  const persist = req.query.persist === "1" || req.query.persist === "true";
  let persistedCount: number | undefined;
  if (persist) {
    const p = await persistSegmentPerformanceSnapshot(win);
    persistedCount = p.count;
  }

  return res.status(200).json({
    ...computed,
    segments: filtered,
    segmentCount: filtered.length,
    dimensionKey: dimKey,
    dimensionValue: dimVal,
    persistedCount,
  });
}
