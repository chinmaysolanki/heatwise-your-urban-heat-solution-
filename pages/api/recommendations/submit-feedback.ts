import type { NextApiRequest, NextApiResponse } from "next";
import { logTelemetryEvent } from "@/lib/services/feedbackLoggingService";
import type { LogTelemetryEventInput } from "@/lib/recommendationTelemetryTypes";
import { readJsonBody, sendStructuredError } from "./_utils";

type Body = Omit<LogTelemetryEventInput, "eventType"> & {
  sentiment: "positive" | "negative";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const body = readJsonBody<Body>(req.body);
  if (!body || (body.sentiment !== "positive" && body.sentiment !== "negative")) {
    return sendStructuredError(
      res,
      { code: "INVALID_JSON", message: "Expected sentiment: positive | negative" },
      400,
    );
  }

  const legacyType =
    body.sentiment === "positive"
      ? "recommendation_feedback_positive"
      : "recommendation_feedback_negative";
  const eventType = body.sentiment === "positive" ? "candidate_rated_positive" : "candidate_rated_negative";

  const out = await logTelemetryEvent({
    ...body,
    eventType,
    metadata: {
      ...(body.metadata ?? {}),
      legacyEventType: legacyType,
    },
  });
  if (!out.ok) {
    if (out.error.code === "DUPLICATE_EVENT") {
      return res.status(200).json({ duplicate: true });
    }
    return sendStructuredError(res, out.error, 400);
  }

  return res.status(201).json({ eventId: out.eventId, eventType });
}
