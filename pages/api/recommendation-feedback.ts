import type { NextApiRequest, NextApiResponse } from "next";
import type { RecommendationFeedbackEvent } from "@/models";
import { recordFeedback } from "@/recommendation-engine";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const body = req.body as Partial<RecommendationFeedbackEvent>;

  if (!body || typeof body !== "object") {
    res.status(400).json({ message: "Invalid JSON body" });
    return;
  }

  if (!body.eventId || !body.recommendationId || !body.action || !body.timestamp) {
    res.status(400).json({ message: "Missing required feedback fields" });
    return;
  }

  try {
    await recordFeedback(body as RecommendationFeedbackEvent);
    res.status(204).end();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record feedback";
    res.status(500).json({ message });
  }
}

