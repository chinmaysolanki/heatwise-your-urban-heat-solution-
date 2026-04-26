import type { NextApiRequest, NextApiResponse } from "next";

import { wrapAdminExport } from "@/lib/adminExport";
import { requireAdminSession } from "@/lib/adminAuth";
import {
  fetchInstallerOutcomeSummary,
  fetchInstallerOutcomesByCohort,
  parseAdminDateWindow,
} from "@/lib/services/adminAnalyticsService";

type InstallerOutcomesPayload = {
  summary: Awaited<ReturnType<typeof fetchInstallerOutcomeSummary>>;
  by_cohort: Awaited<ReturnType<typeof fetchInstallerOutcomesByCohort>>;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET only" } });
  }

  const session = await requireAdminSession(req, res);
  if (!session) return;

  const window = parseAdminDateWindow(req.query);
  const [summary, by_cohort] = await Promise.all([
    fetchInstallerOutcomeSummary(window),
    fetchInstallerOutcomesByCohort(window),
  ]);

  const data: InstallerOutcomesPayload = { summary, by_cohort };
  return res.status(200).json(wrapAdminExport(data, window));
}
