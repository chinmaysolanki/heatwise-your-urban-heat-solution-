import type { NextApiRequest, NextApiResponse } from "next";

import { validationError } from "@/lib/recommendationTelemetryValidation";
import { requireOpsOrAdmin } from "@/lib/opsAuth";
import { listReadinessSubsystemNames, runPlatformReadinessChecks } from "@/lib/services/readinessCheckService";

import { sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  try {
    const aggregate = await runPlatformReadinessChecks();
    return res.status(200).json({
      ...aggregate,
      subsystems_catalog: [...listReadinessSubsystemNames()],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return sendStructuredError(res, validationError("DEPENDENCY_UNAVAILABLE", msg), 503);
  }
}
