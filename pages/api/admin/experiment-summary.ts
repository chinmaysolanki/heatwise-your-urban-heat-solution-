import type { NextApiRequest, NextApiResponse } from "next";

import { wrapAdminExport } from "@/lib/adminExport";
import { requireAdminSession } from "@/lib/adminAuth";
import { parseAdminDateWindow } from "@/lib/services/adminAnalyticsService";
import { fetchExperimentSummary } from "@/lib/services/adminExperimentService";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET only" } });
  }

  const session = await requireAdminSession(req, res);
  if (!session) return;

  const window = parseAdminDateWindow(req.query);
  const summary = await fetchExperimentSummary(window);
  return res.status(200).json(wrapAdminExport(summary, window));
}
