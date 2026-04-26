import type { NextApiRequest, NextApiResponse } from "next";

import { readIdempotencyKey } from "@/lib/httpIdempotency";
import { requireOpsOrAdmin } from "@/lib/opsAuth";
import { submitInstallerQuote } from "@/lib/services/quoteWorkflowService";

import { readJsonBody, sendStructuredError } from "./_utils";

type Body = {
  idempotencyKey?: string | null;
  quoteRequestId: string;
  quoteAssignmentId: string;
  installerId: string;
  quoteAmountInr: number;
  estimatedTimelineDays: number;
  includedScope: Record<string, unknown>;
  excludedScope?: Record<string, unknown> | null;
  proposedSpecies?: unknown;
  proposedMaterials?: unknown;
  notes?: string | null;
  deviationFromRecommendationFlags?: string[] | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<Body>(req.body);
  if (!body?.quoteRequestId || !body.quoteAssignmentId || !body.installerId) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "Missing quote fields" }, 400);
  }

  const idem = readIdempotencyKey(req, body as { idempotencyKey?: string | null });
  const out = await submitInstallerQuote({ ...body, idempotencyKey: idem });
  if (!out.ok) {
    const st =
      out.error.code === "IDEMPOTENCY_IN_FLIGHT" || out.error.code === "IDEMPOTENCY_CONFLICT" ? 409 : 400;
    return sendStructuredError(res, out.error, st);
  }
  if (out.idempotency?.replayed) res.setHeader("x-heatwise-idempotency-replayed", "1");
  if (out.idempotency?.scope) res.setHeader("x-heatwise-idempotency-scope", out.idempotency.scope);
  return res.status(201).json({
    installerQuoteId: out.installerQuoteId,
    ...(out.idempotency ? { idempotency: out.idempotency } : {}),
  });
}
