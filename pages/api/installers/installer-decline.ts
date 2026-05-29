/**
 * POST /api/installers/installer-decline
 * Installer-portal–authed: decline a quote assignment.
 */
import type { NextApiRequest, NextApiResponse } from "next";

import { db } from "@/lib/db";
import { resolveInstallerPortalCredentials } from "@/lib/installerPortalAuth";
import { declineQuoteAssignment } from "@/lib/services/installExecutionService";

import { readJsonBody, sendStructuredError } from "./_utils";

type Body = { quoteAssignmentId: string; reasonCodes?: string[] };

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only" });
  }

  const cred = resolveInstallerPortalCredentials(req);
  if (!cred) return res.status(401).json({ error: "Installer portal credentials required" });

  const installerId =
    cred.kind === "per_installer" ? cred.installerId : cred.unverifiedInstallerIdClaim;
  if (!installerId) return res.status(400).json({ error: "x-heatwise-installer-id required" });

  const body = readJsonBody<Body>(req.body);
  if (!body?.quoteAssignmentId) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "quoteAssignmentId required" }, 400);
  }

  if (cred.kind === "per_installer") {
    const assignment = await db.installerQuoteAssignment.findUnique({
      where: { id: body.quoteAssignmentId },
      select: { installerId: true },
    });
    if (!assignment || assignment.installerId !== installerId) {
      return sendStructuredError(res, { code: "FORBIDDEN", message: "Assignment does not belong to authenticated installer" }, 403);
    }
  }

  const out = await declineQuoteAssignment(body.quoteAssignmentId, body.reasonCodes ?? []);
  if (!out.ok) return sendStructuredError(res, out.error, 400);

  return res.status(200).json({ ok: true });
}
