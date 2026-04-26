import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import { listDueFollowups } from "@/lib/services/remeasurementService";

/**
 * Pending checkpoints with ``dueAt`` on or before ``before`` (default: now UTC).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const beforeRaw = typeof req.query.before === "string" ? req.query.before : null;
  const before = beforeRaw ? new Date(beforeRaw) : new Date();
  if (Number.isNaN(before.getTime())) {
    return res.status(400).json({ error: { code: "INVALID_QUERY", message: "before must be ISO date" } });
  }

  const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 100;
  const rows = await listDueFollowups(before, Number.isFinite(limitRaw) ? limitRaw : 100);

  return res.status(200).json({
    before: before.toISOString(),
    count: rows.length,
    checkpoints: rows.map((c) => ({
      checkpointId: c.id,
      scheduleId: c.scheduleId,
      offsetDays: c.offsetDays,
      windowLabel: c.windowLabel,
      dueAt: c.dueAt.toISOString(),
      checkpointStatus: c.checkpointStatus,
      projectId: c.schedule.projectId,
      projectName: c.schedule.project.name,
      userId: c.schedule.project.userId,
    })),
  });
}
