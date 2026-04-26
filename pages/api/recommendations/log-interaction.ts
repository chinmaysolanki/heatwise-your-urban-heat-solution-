import type { NextApiRequest, NextApiResponse } from "next";
import { logTelemetryEvent } from "@/lib/services/feedbackLoggingService";
import type { LogTelemetryEventInput } from "@/lib/recommendationTelemetryTypes";
import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const body = readJsonBody<LogTelemetryEventInput>(req.body);
  if (!body || !body.eventType) {
    return sendStructuredError(
      res,
      { code: "INVALID_JSON", message: "Expected JSON with eventType and required telemetry fields" },
      400,
    );
  }

  const out = await logTelemetryEvent(body);
  if (!out.ok) {
    if (out.error.code === "DUPLICATE_EVENT") {
      return res.status(200).json({ duplicate: true, message: "feedbackEventId already ingested" });
    }
    return sendStructuredError(res, out.error, 400);
  }

  return res.status(201).json({ eventId: out.eventId });
}
