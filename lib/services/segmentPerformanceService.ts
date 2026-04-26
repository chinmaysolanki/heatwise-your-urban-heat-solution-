import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import {
  buildSegmentKey,
  extractSegmentDimensions,
} from "@/lib/services/learningInsightsShared";

import type { InsightWindow } from "@/lib/services/recommendationInsightService";

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

type Agg = {
  dims: ReturnType<typeof extractSegmentDimensions>;
  segmentKey: string;
  sessionIds: string[];
  scores: number[];
  feasibility: number[];
};

/**
 * Slice sessions into coarse segments (project / climate / budget / region / user / bands).
 */
export async function computeSegmentPerformance(win: InsightWindow) {
  const sessions = await db.recommendationTelemetrySession.findMany({
    where: { generatedAt: { gte: win.windowStart, lte: win.windowEnd } },
    include: { candidateSnapshots: true },
  });

  const map = new Map<string, Agg>();

  for (const s of sessions) {
    const dims = extractSegmentDimensions(s);
    const segmentKey = buildSegmentKey(dims);
    let a = map.get(segmentKey);
    if (!a) {
      a = { dims, segmentKey, sessionIds: [], scores: [], feasibility: [] };
      map.set(segmentKey, a);
    }
    a.sessionIds.push(s.id);
    for (const c of s.candidateSnapshots) {
      if (c.candidateScore != null && Number.isFinite(c.candidateScore)) a.scores.push(c.candidateScore);
      if (c.feasibilityScore != null && Number.isFinite(c.feasibilityScore)) a.feasibility.push(c.feasibilityScore);
    }
  }

  const rows = [...map.values()].map((a) => ({
    segmentKey: a.segmentKey,
    projectType: a.dims.projectType,
    climateZone: a.dims.climateZone,
    budgetBand: a.dims.budgetBand,
    region: a.dims.region,
    userType: a.dims.userType,
    installerAvailabilityBand: a.dims.installerAvailabilityBand,
    personalizationConfidenceBand: a.dims.personalizationConfidenceBand,
    sampleSize: a.sessionIds.length,
    metrics: {
      session_count: a.sessionIds.length,
      avg_candidate_score: avg(a.scores),
      avg_feasibility_score: avg(a.feasibility),
    },
  }));

  return {
    window: { startIso: win.windowStart.toISOString(), endIso: win.windowEnd.toISOString() },
    segmentCount: rows.length,
    segments: rows,
  };
}

export async function persistSegmentPerformanceSnapshot(win: InsightWindow): Promise<{ count: number }> {
  const computed = await computeSegmentPerformance(win);
  let count = 0;
  for (const r of computed.segments) {
    await db.segmentPerformance.create({
      data: {
        windowStart: win.windowStart,
        windowEnd: win.windowEnd,
        segmentKey: r.segmentKey,
        projectType: r.projectType ?? undefined,
        climateZone: r.climateZone ?? undefined,
        budgetBand: r.budgetBand ?? undefined,
        region: r.region ?? undefined,
        userType: r.userType,
        installerAvailabilityBand: r.installerAvailabilityBand,
        personalizationConfidenceBand: r.personalizationConfidenceBand,
        metricsJson: JSON.stringify(r.metrics),
        sampleSize: r.sampleSize,
      },
    });
    count += 1;
  }
  return { count };
}

const ALLOWED_FILTER_KEYS = new Set([
  "projectType",
  "climateZone",
  "budgetBand",
  "region",
  "userType",
  "installerAvailabilityBand",
  "personalizationConfidenceBand",
]);

export function validateSegmentFilterKey(key: string): { ok: true } | { ok: false; error: StructuredError } {
  if (!ALLOWED_FILTER_KEYS.has(key)) {
    return { ok: false, error: validationError("INVALID_SEGMENT_KEY", `unknown dimension: ${key}`) };
  }
  return { ok: true };
}
