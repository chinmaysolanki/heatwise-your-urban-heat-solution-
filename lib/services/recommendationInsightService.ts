import { db } from "@/lib/db";

import { extractSegmentDimensions, primaryRecommendationType } from "@/lib/services/learningInsightsShared";

export type InsightWindow = { windowStart: Date; windowEnd: Date };

export type VariantRollupRow = {
  experimentId: string | null;
  rolloutVariant: string | null;
  recommendationType: string | null;
  scenarioUsageTag: string | null;
  reportDossierType: string | null;
  generatorSource: string | null;
  rulesVersion: string | null;
  modelVersion: string | null;
  sessionCount: number;
  candidateCount: number;
  avgBlendedScore: number | null;
  avgLatencyMs: number | null;
  verifiedInstallCount: number;
  dossierCreatedCount: number;
  followupCompletedCount: number;
  commercialInstalledCount: number;
};

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Cross-layer summary: telemetry, verified installs, dossiers, commercial outcomes, follow-ups.
 */
export async function computeRecommendationSummary(win: InsightWindow) {
  const { windowStart, windowEnd } = win;

  const sessions = await db.recommendationTelemetrySession.findMany({
    where: { generatedAt: { gte: windowStart, lte: windowEnd } },
    include: { candidateSnapshots: true },
  });

  const verifiedInstallCount = await db.verifiedInstallRecord.count({
    where: { verifiedAt: { gte: windowStart, lte: windowEnd } },
  });

  const dossierCreatedCount = await db.recommendationDossier.count({
    where: { generatedAt: { gte: windowStart, lte: windowEnd } },
  });

  const followupCompletedCount = await db.longitudinalFollowupEvent.count({
    where: { eventType: "completion", eventAt: { gte: windowStart, lte: windowEnd } },
  });

  const commercialInstalledCount = await db.commercialOutcome.count({
    where: {
      commercialStatus: "installed",
      installCompletedAt: { gte: windowStart, lte: windowEnd, not: null },
    },
  });

  const totalCandidates = sessions.reduce((n, s) => n + s.candidateSnapshots.length, 0);
  const scores = sessions.flatMap((s) =>
    s.candidateSnapshots.map((c) => c.candidateScore).filter((x): x is number => x != null && Number.isFinite(x)),
  );
  const latencies = sessions.map((s) => s.latencyMs).filter((x) => Number.isFinite(x));

  const variantMap = new Map<string, VariantRollupRow>();

  for (const s of sessions) {
    const recType = primaryRecommendationType(s.candidateSnapshots);
    const key = [
      s.generatorSource ?? "",
      s.rulesVersion ?? "",
      s.modelVersion ?? "",
      recType ?? "",
    ].join("\x1f");

    const row = variantMap.get(key) ?? {
      experimentId: null,
      rolloutVariant: null,
      recommendationType: recType,
      scenarioUsageTag: null,
      reportDossierType: null,
      generatorSource: s.generatorSource,
      rulesVersion: s.rulesVersion,
      modelVersion: s.modelVersion,
      sessionCount: 0,
      candidateCount: 0,
      avgBlendedScore: null,
      avgLatencyMs: null,
      verifiedInstallCount: 0,
      dossierCreatedCount: 0,
      followupCompletedCount: 0,
      commercialInstalledCount: 0,
    };

    row.sessionCount += 1;
    row.candidateCount += s.candidateSnapshots.length;
    variantMap.set(key, row);
  }

  const variantRollups = [...variantMap.values()].map((r) => {
    const subs = sessions.filter(
      (s) =>
        s.generatorSource === r.generatorSource &&
        s.rulesVersion === r.rulesVersion &&
        s.modelVersion === r.modelVersion &&
        primaryRecommendationType(s.candidateSnapshots) === r.recommendationType,
    );
    const sc = subs.flatMap((x) => x.candidateSnapshots.map((c) => c.candidateScore).filter((v): v is number => v != null));
    return {
      ...r,
      avgBlendedScore: avg(sc),
      avgLatencyMs: avg(subs.map((x) => x.latencyMs)),
    };
  });

  const evidenceRefs = [
    { layer: "telemetry", type: "RecommendationTelemetrySession", count: sessions.length },
    { layer: "verified_outcomes", type: "VerifiedInstallRecord", count: verifiedInstallCount },
    { layer: "reporting", type: "RecommendationDossier", count: dossierCreatedCount },
    { layer: "followup", type: "LongitudinalFollowupEvent", count: followupCompletedCount },
    { layer: "commercial", type: "CommercialOutcome", count: commercialInstalledCount },
  ];

  const sourceLayers = [
    "rollout",
    "telemetry",
    "verified_outcomes",
    "followup",
    "pricing",
    "supply",
    "personalization",
    "scenario",
    "reporting",
    "commercial",
  ];

  return {
    window: { startIso: windowStart.toISOString(), endIso: windowEnd.toISOString() },
    aggregates: {
      sessionCount: sessions.length,
      candidateSnapshotCount: totalCandidates,
      avgCandidateScore: avg(scores),
      avgLatencyMs: avg(latencies),
      verifiedInstallCount,
      dossierCreatedCount,
      followupCompletedCount,
      commercialInstalledCount,
    },
    variantRollups,
    evidenceRefs,
    sourceLayers,
  };
}

export async function persistRecommendationInsightSnapshot(
  win: InsightWindow,
  summary: Awaited<ReturnType<typeof computeRecommendationSummary>>,
): Promise<{ recommendationInsightId: string }> {
  const row = await db.recommendationInsight.create({
    data: {
      windowStart: win.windowStart,
      windowEnd: win.windowEnd,
      insightType: "window_summary",
      scopeJson: JSON.stringify({ granularity: "global" }),
      metricsJson: JSON.stringify(summary.aggregates),
      evidenceRefsJson: JSON.stringify(summary.evidenceRefs),
      sourceLayersJson: JSON.stringify(summary.sourceLayers),
    },
  });

  for (const v of summary.variantRollups) {
    await db.variantPerformance.create({
      data: {
        windowStart: win.windowStart,
        windowEnd: win.windowEnd,
        experimentId: v.experimentId ?? undefined,
        rolloutVariant: v.rolloutVariant ?? undefined,
        recommendationType: v.recommendationType ?? undefined,
        scenarioUsageTag: v.scenarioUsageTag ?? undefined,
        reportDossierType: v.reportDossierType ?? undefined,
        generatorSource: v.generatorSource ?? undefined,
        rulesVersion: v.rulesVersion ?? undefined,
        modelVersion: v.modelVersion ?? undefined,
        sessionCount: v.sessionCount,
        candidateCount: v.candidateCount,
        avgBlendedScore: v.avgBlendedScore ?? undefined,
        avgLatencyMs: v.avgLatencyMs ?? undefined,
        verifiedInstallCount: v.verifiedInstallCount,
        dossierCreatedCount: v.dossierCreatedCount,
        followupCompletedCount: v.followupCompletedCount,
        commercialInstalledCount: v.commercialInstalledCount,
      },
    });
  }

  return { recommendationInsightId: row.id };
}
