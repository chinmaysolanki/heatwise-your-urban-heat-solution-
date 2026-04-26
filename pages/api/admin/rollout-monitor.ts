import type { NextApiRequest, NextApiResponse } from "next";

import { wrapAdminExport } from "@/lib/adminExport";
import { requireAdminSession } from "@/lib/adminAuth";
import { parseAdminDateWindow } from "@/lib/services/adminAnalyticsService";
import { fetchRolloutMonitor } from "@/lib/services/adminMonitoringService";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET only" } });
  }

  const session = await requireAdminSession(req, res);
  if (!session) return;

  const window = parseAdminDateWindow(req.query);
  const monitor = await fetchRolloutMonitor(window);
  return res.status(200).json(wrapAdminExport(monitor, window));
}
