import type { NextApiRequest, NextApiResponse } from "next";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { readIdempotencyKey } from "@/lib/httpIdempotency";
import { requireProjectOwner } from "@/lib/opsAuth";
import { createQuoteRequest } from "@/lib/services/quoteWorkflowService";

import { readJsonBody, sendStructuredError } from "./_utils";

type Body = {
  idempotencyKey?: string | null;
  projectId: string;
  recommendationSessionId?: string | null;
  selectedCandidateSnapshotId?: string | null;
  userLocationRegion: string;
  projectSnapshot: Record<string, unknown>;
  candidateSnapshot?: Record<string, unknown> | null;
  notes?: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const session = await getServerSession(req, res, authOptions as NextAuthOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const body = readJsonBody<Body>(req.body);
  if (!body?.projectId) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "projectId required" }, 400);
  }

  const ownerOk = await requireProjectOwner(req, res, body.projectId, userId ?? null);
  if (!ownerOk) return;

  const idem = readIdempotencyKey(req, body as { idempotencyKey?: string | null });
  const out = await createQuoteRequest({
    projectId: body.projectId,
    userId: userId ?? null,
    recommendationSessionId: body.recommendationSessionId,
    selectedCandidateSnapshotId: body.selectedCandidateSnapshotId,
    userLocationRegion: body.userLocationRegion,
    projectSnapshot: body.projectSnapshot ?? {},
    candidateSnapshot: body.candidateSnapshot,
    notes: body.notes,
    idempotencyKey: idem,
  });

  if (!out.ok) {
    const st =
      out.error.code === "IDEMPOTENCY_IN_FLIGHT" || out.error.code === "IDEMPOTENCY_CONFLICT" ? 409 : 400;
    return sendStructuredError(res, out.error, st);
  }
  if (out.idempotency?.replayed) res.setHeader("x-heatwise-idempotency-replayed", "1");
  if (out.idempotency?.scope) res.setHeader("x-heatwise-idempotency-scope", out.idempotency.scope);
  return res.status(201).json({
    quoteRequestId: out.quoteRequestId,
    ...(out.idempotency ? { idempotency: out.idempotency } : {}),
  });
}
