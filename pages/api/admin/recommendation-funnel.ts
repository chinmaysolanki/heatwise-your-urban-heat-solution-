import type { NextApiRequest, NextApiResponse } from "next";

import { wrapAdminExport } from "@/lib/adminExport";
import { requireAdminSession } from "@/lib/adminAuth";
import { fetchRecommendationFunnel, parseAdminDateWindow } from "@/lib/services/adminAnalyticsService";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET only" } });
  }

  const session = await requireAdminSession(req, res);
  if (!session) return;

  const window = parseAdminDateWindow(req.query);
  const funnel = await fetchRecommendationFunnel(window);
  return res.status(200).json(wrapAdminExport(funnel, window));
}
