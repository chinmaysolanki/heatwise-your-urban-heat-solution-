import type { NextApiRequest, NextApiResponse } from "next";

import type { RuntimeCandidate } from "@/lib/ml/recommendationRuntimeTypes";
import { buildStructuredExplanation } from "@/lib/services/recommendationExplanationService";
import { readJsonBody, sendStructuredError } from "./_utils";

type ExplainBody = {
  candidate: RuntimeCandidate;
  telemetryMeta?: Record<string, unknown>;
  runExplanation?: Record<string, unknown>;
};

/**
 * Returns a UI-oriented explanation payload for one candidate (from ``/api/recommendations/generate``).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const body = readJsonBody<ExplainBody>(req.body);
  if (!body?.candidate) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "Expected candidate object" }, 400);
  }

  const structured = buildStructuredExplanation({
    candidate: body.candidate,
    telemetryMeta: body.telemetryMeta,
    runExplanation: body.runExplanation,
  });

  return res.status(200).json(structured);
}
