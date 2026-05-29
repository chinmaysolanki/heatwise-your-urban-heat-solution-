/**
 * POST /api/installers/installer-submit-quote
 * Installer-portal–authed: submit a quote for an assigned quote request.
 * Validates that the assignment belongs to the authenticated installer.
 */
import type { NextApiRequest, NextApiResponse } from "next";

import { db } from "@/lib/db";
import { readIdempotencyKey } from "@/lib/httpIdempotency";
import { resolveInstallerPortalCredentials } from "@/lib/installerPortalAuth";
import { submitInstallerQuote } from "@/lib/services/quoteWorkflowService";

import { readJsonBody, sendStructuredError } from "./_utils";

type Body = {
  quoteRequestId: string;
  quoteAssignmentId: string;
  quoteAmountInr: number;
  estimatedTimelineDays: number;
  includedScope: Record<string, unknown>;
  excludedScope?: Record<string, unknown> | null;
  proposedSpecies?: unknown;
  notes?: string | null;
  idempotencyKey?: string | null;
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
  if (!body?.quoteRequestId || !body.quoteAssignmentId || !body.quoteAmountInr || !body.estimatedTimelineDays) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "quoteRequestId, quoteAssignmentId, quoteAmountInr, estimatedTimelineDays required" }, 400);
  }

  // Verify this assignment belongs to this installer
  if (cred.kind === "per_installer") {
    const assignment = await db.installerQuoteAssignment.findUnique({
      where: { id: body.quoteAssignmentId },
      select: { installerId: true },
    });
    if (!assignment || assignment.installerId !== installerId) {
      return sendStructuredError(res, { code: "FORBIDDEN", message: "Assignment does not belong to authenticated installer" }, 403);
    }
  }

  const idem = readIdempotencyKey(req, body);
  const out = await submitInstallerQuote({
    quoteRequestId: body.quoteRequestId,
    quoteAssignmentId: body.quoteAssignmentId,
    installerId,
    quoteAmountInr: body.quoteAmountInr,
    estimatedTimelineDays: body.estimatedTimelineDays,
    includedScope: body.includedScope ?? { items: [] },
    excludedScope: body.excludedScope ?? null,
    proposedSpecies: body.proposedSpecies ?? null,
    notes: body.notes ?? null,
    idempotencyKey: idem,
  });

  if (!out.ok) {
    const st = out.error.code === "IDEMPOTENCY_IN_FLIGHT" || out.error.code === "IDEMPOTENCY_CONFLICT" ? 409 : 400;
    return sendStructuredError(res, out.error, st);
  }
  if (out.idempotency?.replayed) res.setHeader("x-heatwise-idempotency-replayed", "1");

  return res.status(201).json({ installerQuoteId: out.installerQuoteId });
}
