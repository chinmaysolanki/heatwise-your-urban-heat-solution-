import type { NextApiRequest, NextApiResponse } from "next";

import { db } from "@/lib/db";
import { readIdempotencyKey } from "@/lib/httpIdempotency";
import { requireInstallerPortalOrOps } from "@/lib/opsAuth";
import { submitVerifiedInstall } from "@/lib/services/verifiedOutcomeService";

import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const auth = await requireInstallerPortalOrOps(req, res);
  if (!auth) return;

  res.setHeader("x-heatwise-auth-channel", auth.channel);
  if (auth.channel === "installer_portal") {
    res.setHeader("x-heatwise-installer-portal-kind", auth.credential.kind);
    if (auth.credential.kind === "per_installer") {
      res.setHeader("x-heatwise-installer-id", auth.credential.installerId);
    } else if (auth.credential.unverifiedInstallerIdClaim) {
      res.setHeader(
        "x-heatwise-installer-id-claim-unverified",
        auth.credential.unverifiedInstallerIdClaim,
      );
    }
  }

  const body = readJsonBody<Parameters<typeof submitVerifiedInstall>[0]>(req.body);
  if (!body?.installJobId) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "installJobId required" }, 400);
  }

  if (auth.channel === "installer_portal" && auth.credential.kind === "per_installer") {
    const job = await db.installerInstallJob.findUnique({
      where: { id: body.installJobId },
      select: { installerId: true },
    });
    if (!job || job.installerId !== auth.credential.installerId) {
      return sendStructuredError(
        res,
        {
          code: "INSTALLER_JOB_MISMATCH",
          message: "Authenticated installer is not assigned to this install job",
        },
        403,
      );
    }
  }

  const idem = readIdempotencyKey(req, body as { idempotencyKey?: string | null });
  const out = await submitVerifiedInstall({
    ...body,
    idempotencyKey: idem ?? body.idempotencyKey ?? null,
    mismatchReasonCodes: Array.isArray(body.mismatchReasonCodes) ? body.mismatchReasonCodes : [],
  });
  if (!out.ok) {
    const st =
      out.error.code === "IDEMPOTENCY_IN_FLIGHT" || out.error.code === "IDEMPOTENCY_CONFLICT" ? 409 : 400;
    return sendStructuredError(res, out.error, st);
  }

  if (out.idempotency?.replayed) res.setHeader("x-heatwise-idempotency-replayed", "1");
  if (out.idempotency?.scope) res.setHeader("x-heatwise-idempotency-scope", out.idempotency.scope);

  return res.status(201).json({
    verifiedInstallId: out.verifiedInstallId,
    ...(out.idempotency ? { idempotency: out.idempotency } : {}),
  });
}
