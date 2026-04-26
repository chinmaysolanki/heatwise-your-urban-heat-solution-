import type { NextApiRequest, NextApiResponse } from "next";
import { readIdempotencyKey } from "@/lib/httpIdempotency";
import { createRecommendationSession } from "@/lib/services/recommendationTelemetryService";
import type { CreateRecommendationSessionInput } from "@/lib/recommendationTelemetryTypes";
import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const raw = readJsonBody<CreateRecommendationSessionInput>(req.body);
  const body = raw
    ? { ...raw, idempotencyKey: readIdempotencyKey(req, raw) ?? raw.idempotencyKey ?? null }
    : null;
  if (!body) {
    return sendStructuredError(res, { code: "INVALID_JSON", message: "Expected JSON object body" }, 400);
  }

  const out = await createRecommendationSession(body);
  if (!out.ok) {
    const status =
      out.error.code === "IDEMPOTENCY_CONFLICT" || out.error.code === "DUPLICATE_RANK" ? 409 : 400;
    return sendStructuredError(res, out.error, status);
  }

  if (out.data.idempotency) {
    if (out.data.idempotency.replayed) res.setHeader("x-heatwise-idempotency-replayed", "1");
    res.setHeader("x-heatwise-idempotency-scope", out.data.idempotency.scope);
  }

  return res.status(201).json({
    recommendationSessionId: out.data.recommendationSessionId,
    candidateSnapshotIds: out.data.candidateSnapshotIds,
    ...(out.data.idempotency ? { idempotency: out.data.idempotency } : {}),
  });
}
