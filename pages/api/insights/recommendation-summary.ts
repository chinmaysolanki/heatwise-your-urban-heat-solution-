import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import {
  computeRecommendationSummary,
  persistRecommendationInsightSnapshot,
} from "@/lib/services/recommendationInsightService";

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

  const summary = await computeRecommendationSummary(win);
  const persist = req.query.persist === "1" || req.query.persist === "true";

  let recommendationInsightId: string | undefined;
  if (persist) {
    const p = await persistRecommendationInsightSnapshot(win, summary);
    recommendationInsightId = p.recommendationInsightId;
  }

  return res.status(200).json({
    ...summary,
    notes: [
      "Variant rollups group by generatorSource + rulesVersion + modelVersion + primary recommendation_type; per-variant verified/dossier/commercial counts are not yet attributed (left 0 until session-variant linkage is stored).",
    ],
    recommendationInsightId,
  });
}
