import type { NextApiRequest, NextApiResponse } from "next";
import { logTelemetryEvent, markCandidateShown } from "@/lib/services/feedbackLoggingService";
import type { LogTelemetryEventInput } from "@/lib/recommendationTelemetryTypes";
import { readJsonBody, sendStructuredError } from "./_utils";

type Body = LogTelemetryEventInput & { markShown?: boolean };

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const body = readJsonBody<Body>(req.body);
  if (!body) {
    return sendStructuredError(res, { code: "INVALID_JSON", message: "Expected JSON object body" }, 400);
  }

  const payload: LogTelemetryEventInput = {
    ...body,
    eventType: "recommendation_impression",
  };

  const out = await logTelemetryEvent(payload);
  if (!out.ok) {
    if (out.error.code === "DUPLICATE_EVENT") {
      return res.status(200).json({ duplicate: true, message: "feedbackEventId already ingested" });
    }
    return sendStructuredError(res, out.error, 400);
  }

  if (body.markShown !== false && body.candidateSnapshotId) {
    await markCandidateShown(body.candidateSnapshotId);
  }

  return res.status(201).json({ eventId: out.eventId });
}
