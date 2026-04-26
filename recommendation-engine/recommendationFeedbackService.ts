// ============================================================
// HeatWise — Recommendation Feedback Service
// recommendation-engine/recommendationFeedbackService.ts
//
// Lightweight, in-memory event collector for user interactions
// with recommendations. Intended as a staging point before
// sending data to analytics / long-term storage for ML.
// ============================================================

import type { RecommendationFeedbackEvent } from "@/models";
import { db } from "@/lib/db";

export async function recordFeedback(
  event: RecommendationFeedbackEvent,
): Promise<void> {
  let candidateId: string | undefined;

  // Best-effort linkage of feedback to the most recent matching candidate
  try {
    const candidate = await db.recommendationCandidate.findFirst({
      where: {
        recommendationId: event.recommendationId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    if (candidate) {
      candidateId = candidate.id;
    }
  } catch {
    // Linking failure should not block feedback persistence
  }

  await db.recommendationFeedbackEvent.create({
    data: {
      eventId:          event.eventId,
      userId:           event.userId ?? null,
      recommendationId: event.recommendationId,
      projectId:        event.projectId ?? null,
      action:           event.action,
      timestamp:        new Date(event.timestamp),
      dwellMs:          event.dwellMs ?? null,
      scoreBefore:      event.scoreBefore ?? null,
      scoreAfter:       event.scoreAfter ?? null,
      notes:            event.notes ?? null,
      extra:            event.extra ? JSON.stringify(event.extra) : null,
      candidateId:      candidateId ?? null,
    },
  });
}

export async function getFeedbackSnapshot(filter?: {
  projectId?: string;
  recommendationId?: string;
  userId?: string;
}): Promise<RecommendationFeedbackEvent[]> {
  const where: {
    projectId?: string;
    recommendationId?: string;
    userId?: string;
  } = {};

  if (filter?.projectId) where.projectId = filter.projectId;
  if (filter?.recommendationId) where.recommendationId = filter.recommendationId;
  if (filter?.userId) where.userId = filter.userId;

  const rows = await db.recommendationFeedbackEvent.findMany({
    where,
    orderBy: { timestamp: "desc" },
  });

  return rows.map((row: any) => ({
    eventId:          row.eventId,
    userId:           row.userId ?? undefined,
    recommendationId: row.recommendationId,
    projectId:        row.projectId ?? undefined,
    candidateId:      row.candidateId ?? undefined,
    action:           row.action as RecommendationFeedbackEvent["action"],
    timestamp:        row.timestamp.toISOString(),
    dwellMs:          row.dwellMs ?? undefined,
    scoreBefore:      row.scoreBefore ?? undefined,
    scoreAfter:       row.scoreAfter ?? undefined,
    notes:            row.notes ?? undefined,
    extra:            row.extra ? JSON.parse(row.extra) : undefined,
  }));
}

export async function clearFeedback(): Promise<void> {
  await db.recommendationFeedbackEvent.deleteMany({});
}

