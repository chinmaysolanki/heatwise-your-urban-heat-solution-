import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Discovery endpoint: “scenario” in HeatWise is **dossier/report metadata**, not a standalone
 * scenario orchestration API. See `docs/SCENARIO_AND_DOSSIER.md`.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse): void {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET only" } });
    return;
  }

  res.status(200).json({
    kind: "dossier_report_scenario_framing",
    summary:
      "Scenario fields in analytics/ML exports refer to summaries attached to dossiers and reports (e.g. tags on variant rows). Use recommendation generate, create-session, and reporting flows; there is no separate scenario mutation API.",
    persistedSummarySchemaVersion: "hw_scenario_summary_v1",
    documentationPaths: ["docs/SCENARIO_AND_DOSSIER.md", "docs/RECOMMENDATION_STACKS.md"],
  });
}
