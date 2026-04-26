import { db } from "@/lib/db";
import { isSaveAction, isViewAction } from "@/lib/feedbackActions";

function safeJsonParse<T = any>(s: unknown): T | null {
  if (typeof s !== "string" || !s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function buildAdminAnalytics() {
  const [
    runsCount,
    installCount,
    feedbackCounts,
    photoSessions,
    visRecords,
    pipelineEvents,
  ] = await Promise.all([
    db.recommendationRun.count(),
    db.installationRequest.count(),
    db.recommendationFeedbackEvent.groupBy({
      by: ["action"],
      _count: { action: true },
    }),
    db.photoSession.findMany({
      select: {
        id: true,
        recommendationJson: true,
        selectedCandidate: {
          select: {
            rank: true,
            heatReductionSummary: true,
            costEstimate: true,
          },
        },
      },
    }),
    db.visualizationRecord.findMany({
      select: {
        id: true,
        photoSessionId: true,
        generationVersion: true,
      },
    }),
    db.photoPipelineEvent.findMany({
      select: {
        id: true,
        action: true,
      },
    }),
  ]);

  const feedbackMap = Object.fromEntries(
    feedbackCounts.map((r: any) => [r.action, r._count.action]),
  ) as Record<string, number>;

  const sessionsWithRecs = photoSessions.filter((s: any) => !!s.recommendationJson);
  const denomSessions = sessionsWithRecs.length || 0;

  const selectedRanks = sessionsWithRecs
    .map((s: any) => s.selectedCandidate?.rank)
    .filter((r: any): r is number => typeof r === "number" && Number.isFinite(r));

  let saveEvents = 0;
  let viewEvents = 0;
  for (const [action, count] of Object.entries(feedbackMap)) {
    if (isSaveAction(action)) saveEvents += count;
    if (isViewAction(action)) viewEvents += count;
  }

  const sessionsWithVisualization = new Set(
    visRecords.map((v: any) => v.photoSessionId).filter(Boolean) as string[],
  );

  const regenCount = visRecords.filter(
    (v: any) => (v.generationVersion ?? 1) > 1,
  ).length;
  const visualizationCount = visRecords.length;

  const drops: number[] = [];
  for (const s of sessionsWithRecs) {
    const heat = safeJsonParse<any>(s.selectedCandidate?.heatReductionSummary);
    const drop = heat?.estimatedDropC;
    if (typeof drop === "number" && Number.isFinite(drop)) drops.push(drop);
  }

  const mins: number[] = [];
  const maxs: number[] = [];
  for (const s of sessionsWithRecs) {
    const cost = safeJsonParse<any>(s.selectedCandidate?.costEstimate);
    const min = cost?.totalMin;
    const max = cost?.totalMax;
    if (typeof min === "number" && Number.isFinite(min)) mins.push(min);
    if (typeof max === "number" && Number.isFinite(max)) maxs.push(max);
  }

  const pipelineActionCounts: Record<string, number> = {};
  for (const evt of pipelineEvents) {
    const key = String((evt as any).action || "").toLowerCase();
    if (!key) continue;
    pipelineActionCounts[key] = (pipelineActionCounts[key] ?? 0) + 1;
  }

  return {
    recommendationRuns: {
      total: runsCount,
    },
    topCandidateRankSelected: {
      averageRank: avg(selectedRanks),
      samples: selectedRanks.length,
    },
    saveRate: {
      savedEvents: saveEvents,
      viewEvents,
      rate: viewEvents > 0 ? saveEvents / viewEvents : null,
    },
    visualizationGenerationRate: {
      sessionsWithRecs: denomSessions,
      sessionsWithVisualization: sessionsWithVisualization.size,
      rate: denomSessions > 0 ? sessionsWithVisualization.size / denomSessions : null,
    },
    regenerationRate: {
      totalVisualizations: visualizationCount,
      regenerations: regenCount,
      rate: visualizationCount > 0 ? regenCount / visualizationCount : null,
    },
    installationRequestConversionRate: {
      installationRequests: installCount,
      sessionsWithRecs: denomSessions,
      rate: denomSessions > 0 ? installCount / denomSessions : null,
    },
    heatReduction: {
      averageEstimatedDropC: avg(drops),
      samples: drops.length,
    },
    costEstimate: {
      averageTotalMin: avg(mins),
      averageTotalMax: avg(maxs),
      samples: Math.min(mins.length, maxs.length),
    },
    photoPipeline: {
      actions: pipelineActionCounts,
      totalEvents: pipelineEvents.length,
    },
    debug: {
      feedbackActions: feedbackMap,
    },
  };
}

