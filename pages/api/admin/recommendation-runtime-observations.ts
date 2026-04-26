import type { NextApiRequest, NextApiResponse } from "next";

import { wrapAdminExport } from "@/lib/adminExport";
import { requireAdminSession } from "@/lib/adminAuth";
import { parseAdminDateWindow } from "@/lib/services/adminAnalyticsService";
import { fetchRecommendationRuntimeObservationsExport } from "@/lib/services/recommendationRuntimeObservationService";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET only" } });
  }

  const session = await requireAdminSession(req, res);
  if (!session) return;

  const window = parseAdminDateWindow(req.query);
  const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 500;
  const limit = Number.isFinite(limitRaw) ? limitRaw : 500;
  const cursorId = typeof req.query.cursor === "string" && req.query.cursor.length > 0 ? req.query.cursor : null;

  const { rows, nextCursorId } = await fetchRecommendationRuntimeObservationsExport({
    window,
    limit,
    cursorId,
  });

  return res.status(200).json(
    wrapAdminExport(
      {
        rows,
        next_cursor: nextCursorId,
        row_count: rows.length,
      },
      window,
    ),
  );
}
