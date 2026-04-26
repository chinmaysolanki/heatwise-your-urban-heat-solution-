import type { NextApiRequest, NextApiResponse } from "next";
import { readIdempotencyKey } from "@/lib/httpIdempotency";
import { submitInstallOutcome } from "@/lib/services/installOutcomeService";
import type { SubmitInstallOutcomeInput } from "@/lib/recommendationTelemetryTypes";
import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const raw = readJsonBody<SubmitInstallOutcomeInput>(req.body);
  if (!raw) {
    return sendStructuredError(res, { code: "INVALID_JSON", message: "Expected JSON object body" }, 400);
  }

  const body = { ...raw, idempotencyKey: readIdempotencyKey(req, raw) ?? raw.idempotencyKey ?? null };
  const out = await submitInstallOutcome(body);
  if (!out.ok) {
    const status = out.error.code === "DUPLICATE_OUTCOME" ? 409 : 400;
    return sendStructuredError(res, out.error, status);
  }

  if (out.idempotency?.replayed) res.setHeader("x-heatwise-idempotency-replayed", "1");
  if (out.idempotency?.scope) res.setHeader("x-heatwise-idempotency-scope", out.idempotency.scope);

  return res.status(201).json({
    installOutcomeId: out.installOutcomeId,
    ...(out.idempotency ? { idempotency: out.idempotency } : {}),
  });
}
