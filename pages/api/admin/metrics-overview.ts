import type { NextApiRequest, NextApiResponse } from "next";

import { wrapAdminExport } from "@/lib/adminExport";
import type { MetricsOverviewPayload } from "@/lib/adminAnalyticsTypes";
import { requireAdminSession } from "@/lib/adminAuth";
import {
  countSessionsAndEvents,
  fetchCohortMetrics,
  fetchInstallerOutcomeSummary,
  fetchRecommendationFunnel,
  parseAdminDateWindow,
} from "@/lib/services/adminAnalyticsService";

/**
 * Combined funnel + install outcomes + volume counts (export-ready).
 * Auth: see `lib/adminAuth.ts` — NextAuth session + HEATWISE_ADMIN_EMAILS in production.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET only" } });
  }

  const session = await requireAdminSession(req, res);
  if (!session) return;

  const window = parseAdminDateWindow(req.query);
  const includeCohorts = req.query.include_cohorts === "1" || req.query.include_cohorts === "true";
  const [funnel, outcomes, counts, cohortFunnel] = await Promise.all([
    fetchRecommendationFunnel(window),
    fetchInstallerOutcomeSummary(window),
    countSessionsAndEvents(window),
    includeCohorts ? fetchCohortMetrics(window) : Promise.resolve(undefined),
  ]);

  const data: MetricsOverviewPayload = {
    funnel,
    outcomes,
    sessions_in_window: counts.sessions,
    events_in_window: counts.events,
    ...(cohortFunnel ? { cohort_funnel: cohortFunnel } : {}),
  };

  return res.status(200).json(wrapAdminExport(data, window));
}
