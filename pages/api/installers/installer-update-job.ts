/**
 * POST /api/installers/installer-update-job
 * Installer-portal–authed: update status of an install job that belongs to this installer.
 * Allowed transitions: scheduled → started, started → completed.
 */
import type { NextApiRequest, NextApiResponse } from "next";

import { db } from "@/lib/db";
import { resolveInstallerPortalCredentials } from "@/lib/installerPortalAuth";
import { updateInstallJobStatus } from "@/lib/services/installExecutionService";

import { readJsonBody, sendStructuredError } from "./_utils";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  scheduled: ["started"],
  started: ["completed"],
};

type Body = {
  installJobId: string;
  nextStatus: string;
  startedAt?: string | null;
  completedAt?: string | null;
  finalCostInr?: number | null;
  jobNotes?: string | null;
};

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
  if (!body?.installJobId || !body.nextStatus) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "installJobId and nextStatus required" }, 400);
  }

  const job = await db.installerInstallJob.findUnique({
    where: { id: body.installJobId },
    select: { installerId: true, jobStatus: true },
  });

  if (!job) return sendStructuredError(res, { code: "NOT_FOUND", message: "Job not found" }, 404);

  if (cred.kind === "per_installer" && job.installerId !== installerId) {
    return sendStructuredError(res, { code: "FORBIDDEN", message: "Job does not belong to authenticated installer" }, 403);
  }

  const allowed = ALLOWED_TRANSITIONS[job.jobStatus] ?? [];
  if (!allowed.includes(body.nextStatus)) {
    return sendStructuredError(res, {
      code: "INVALID_TRANSITION",
      message: `Cannot transition from ${job.jobStatus} to ${body.nextStatus}. Allowed: ${allowed.join(", ") || "none"}`,
    }, 400);
  }

  const out = await updateInstallJobStatus(body.installJobId, body.nextStatus, {
    startedAt: body.startedAt ?? (body.nextStatus === "started" ? new Date().toISOString() : null),
    completedAt: body.completedAt ?? (body.nextStatus === "completed" ? new Date().toISOString() : null),
    finalCostInr: body.finalCostInr ?? null,
    jobNotes: body.jobNotes ?? null,
  });

  if (!out.ok) return sendStructuredError(res, out.error, 400);
  return res.status(200).json({ ok: true });
}
