import type { RolloutMonitorPayload } from "@/lib/adminAnalyticsTypes";
import { loadExperimentsFile } from "@/lib/services/experimentAssignmentService";
import { readRolloutState } from "@/lib/services/rolloutControlService";
import { db } from "@/lib/db";
import { fetchRecommendationRuntimeObservability } from "@/lib/services/recommendationRuntimeObservationService";

import type { AdminDateWindow } from "@/lib/services/adminAnalyticsService";

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export async function fetchRolloutMonitor(window: AdminDateWindow): Promise<RolloutMonitorPayload> {
  const rollout_state = readRolloutState() as unknown as Record<string, unknown>;
  const experiments = loadExperimentsFile();
  const active = experiments.experiments.filter((e) => e.status === "active").length;

  const sessions = await db.recommendationTelemetrySession.findMany({
    where: { generatedAt: { gte: window.start, lte: window.end } },
    select: { latencyMs: true, generatorSource: true },
  });

  const latencies = sessions.map((s) => s.latencyMs);
  const rulesOnly = sessions.filter((s) => s.generatorSource === "live_rules").length;
  const hybrid = sessions.filter(
    (s) =>
      s.generatorSource === "hybrid" ||
      s.generatorSource === "ml_ranker" ||
      s.generatorSource === "catalog_hybrid_ts",
  ).length;
  const n = sessions.length;

  let recommendation_runtime;
  try {
    recommendation_runtime = await fetchRecommendationRuntimeObservability(window);
  } catch (e) {
    console.warn("[fetchRolloutMonitor] recommendation_runtime aggregate failed", e);
    recommendation_runtime = undefined;
  }

  return {
    rollout_state,
    active_experiments_count: active,
    health_proxy: {
      telemetry_sessions_last_window: n,
      median_latency_ms: median(latencies),
      rules_only_session_share: n > 0 ? rulesOnly / n : null,
      hybrid_session_share: n > 0 ? hybrid / n : null,
    },
    ...(recommendation_runtime ? { recommendation_runtime } : {}),
  };
}
