import type { NextApiRequest, NextApiResponse } from "next";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { hasValidOpsToken } from "@/lib/opsAuth";
import { requireProjectOwner } from "@/lib/opsAuth";
import { createFollowupSchedule } from "@/lib/services/followupSchedulingService";

import { readJsonBody, sendStructuredError } from "./_utils";

type Body = {
  projectId: string;
  baselineAt: string;
  verifiedInstallId?: string | null;
  offsetsDays?: number[];
};

/**
 * Create 7d/30d/90d/180d checkpoints (or subset). Auth: project owner session **or** ops token.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const body = readJsonBody<Body>(req.body);
  if (!body?.projectId || !body.baselineAt) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "projectId and baselineAt required" }, 400);
  }

  if (!hasValidOpsToken(req)) {
    const session = await getServerSession(req, res, authOptions as NextAuthOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    const ownerOk = await requireProjectOwner(req, res, body.projectId, userId ?? null);
    if (!ownerOk) return;
  }

  const session = await getServerSession(req, res, authOptions as NextAuthOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const out = await createFollowupSchedule({
    projectId: body.projectId,
    userId,
    baselineAt: body.baselineAt,
    verifiedInstallId: body.verifiedInstallId,
    offsetsDays: body.offsetsDays,
  });

  if (!out.ok) {
    return sendStructuredError(res, out.error, 400);
  }
  return res.status(201).json({ followupScheduleId: out.scheduleId });
}
