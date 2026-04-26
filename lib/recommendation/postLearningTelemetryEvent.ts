/**
 * Client-safe POST to /api/recommendations/log-interaction (Phase 6).
 */

export type PostLearningTelemetryParams = {
  sessionId: string;
  projectId: string;
  userId?: string | null;
  eventType: string;
  candidateSnapshotId?: string | null;
  screenName?: string | null;
  uiPosition?: number | null;
  metadata?: Record<string, unknown> | null;
};

export async function postLearningTelemetryEvent(p: PostLearningTelemetryParams): Promise<boolean> {
  const feedbackEventId = `hw-${p.sessionId}-${p.eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const res = await fetch("/api/recommendations/log-interaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feedbackEventId,
        sessionId: p.sessionId,
        projectId: p.projectId,
        userId: p.userId ?? null,
        eventType: p.eventType,
        eventSource: "heatwise_app",
        screenName: p.screenName ?? null,
        uiPosition: p.uiPosition ?? null,
        candidateSnapshotId: p.candidateSnapshotId ?? null,
        metadata: p.metadata ?? null,
      }),
    });
    return res.ok || res.status === 200;
  } catch {
    return false;
  }
}
