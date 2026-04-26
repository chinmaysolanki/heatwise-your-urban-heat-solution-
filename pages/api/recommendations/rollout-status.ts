import type { NextApiRequest, NextApiResponse } from "next";

import { getRolloutStatusSnapshot } from "@/lib/services/rolloutControlService";
import { sendStructuredError } from "./_utils";

/**
 * Internal/admin: active experiments, rollout pointer, experiment counts.
 * Protect in production (middleware / auth) — not done here for v1.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET only" } });
  }

  try {
    const snap = getRolloutStatusSnapshot();
    return res.status(200).json({
      rollout: snap.rollout,
      activeExperiments: snap.activeExperiments,
      experimentCount: snap.experiments.experiments.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "read_error";
    return sendStructuredError(res, { code: "ROLLOUT_READ_ERROR", message: msg }, 500);
  }
}
