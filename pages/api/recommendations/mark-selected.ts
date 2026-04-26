import type { NextApiRequest, NextApiResponse } from "next";
import { logTelemetryEvent } from "@/lib/services/feedbackLoggingService";
import type { LogTelemetryEventInput } from "@/lib/recommendationTelemetryTypes";
import { readJsonBody, sendStructuredError } from "./_utils";

type Body = Omit<LogTelemetryEventInput, "eventType">;

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const body = readJsonBody<Body>(req.body);
  if (!body) {
    return sendStructuredError(res, { code: "INVALID_JSON", message: "Expected JSON object body" }, 400);
  }

  const out = await logTelemetryEvent({
    ...body,
    eventType: "candidate_selected",
    metadata: {
      ...(body.metadata ?? {}),
      legacyEventType: "recommendation_select",
      selectionMarkedAt: new Date().toISOString(),
    },
  });

  if (!out.ok) {
    if (out.error.code === "DUPLICATE_EVENT") {
      return res.status(200).json({ duplicate: true });
    }
    return sendStructuredError(res, out.error, 400);
  }

  return res.status(201).json({
    eventId: out.eventId,
    eventType: "candidate_selected",
    warning:
      !body.candidateSnapshotId
        ? "candidateSnapshotId missing — add for training-quality selection rows"
        : undefined,
  });
}
