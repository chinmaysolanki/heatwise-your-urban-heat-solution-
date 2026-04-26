import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import { FUNNEL_STAGE_ORDER, FUNNEL_STAGES } from "@/lib/commercialConstants";
import type {
  FunnelSummaryFilters,
  FunnelSummaryResult,
  LogLeadFunnelEventInput,
} from "@/lib/commercialTypes";

function isFunnelStage(x: string): boolean {
  return (FUNNEL_STAGES as readonly string[]).includes(x);
}

/**
 * Append-only funnel milestone.
 */
export async function logLeadFunnelEvent(
  input: LogLeadFunnelEventInput,
): Promise<{ ok: true; leadFunnelEventId: string } | { ok: false; error: StructuredError }> {
  if (!isFunnelStage(input.funnelStage)) {
    return { ok: false, error: validationError("INVALID_FUNNEL_STAGE", "unknown funnel_stage") };
  }
  if (!String(input.eventType || "").trim()) {
    return { ok: false, error: validationError("INVALID_BODY", "event_type required") };
  }
  if (!String(input.projectId || "").trim()) {
    return { ok: false, error: validationError("INVALID_BODY", "project_id required") };
  }

  const eventTimestamp = input.eventTimestamp ? new Date(input.eventTimestamp) : new Date();
  if (Number.isNaN(eventTimestamp.getTime())) {
    return { ok: false, error: validationError("INVALID_DATE", "event_timestamp invalid") };
  }

  const prior = await db.leadFunnelEvent.findMany({
    where: { projectId: input.projectId },
    select: { funnelStage: true, eventTimestamp: true },
    orderBy: { eventTimestamp: "asc" },
  });

  const chain = [
    ...prior.map((p) => ({ funnelStage: p.funnelStage, eventTimestamp: p.eventTimestamp })),
    { funnelStage: input.funnelStage, eventTimestamp },
  ].sort((a, b) => a.eventTimestamp.getTime() - b.eventTimestamp.getTime());

  for (let i = 1; i < chain.length; i++) {
    const o0 = FUNNEL_STAGE_ORDER[chain[i - 1].funnelStage] ?? 0;
    const o1 = FUNNEL_STAGE_ORDER[chain[i].funnelStage] ?? 0;
    if (o1 < o0) {
      return {
        ok: false,
        error: validationError(
          "IMPOSSIBLE_FUNNEL_SEQUENCE",
          `funnel stages must be non-decreasing when sorted by event_timestamp (${chain[i - 1].funnelStage} -> ${chain[i].funnelStage})`,
        ),
      };
    }
  }

  const row = await db.leadFunnelEvent.create({
    data: {
      eventType: input.eventType.trim(),
      eventTimestamp,
      userId: input.userId ?? undefined,
      projectId: input.projectId,
      recommendationSessionId: input.recommendationSessionId ?? undefined,
      quoteRequestId: input.quoteRequestId ?? undefined,
      installerQuoteId: input.installerQuoteId ?? undefined,
      installJobId: input.installJobId ?? undefined,
      installerId: input.installerId ?? undefined,
      funnelStage: input.funnelStage,
      sourceChannel: input.sourceChannel ?? undefined,
      campaignId: input.campaignId ?? undefined,
      region: input.region ?? undefined,
      projectType: input.projectType ?? undefined,
      budgetBand: input.budgetBand ?? undefined,
      metadataJson:
        input.metadata && Object.keys(input.metadata).length > 0 ? JSON.stringify(input.metadata) : undefined,
    },
  });

  return { ok: true, leadFunnelEventId: row.id };
}

function buildFunnelWhere(f: FunnelSummaryFilters): Record<string, unknown> {
  const base: Record<string, unknown> = {
    eventTimestamp: { gte: f.windowStart, lte: f.windowEnd },
  };
  if (f.region) base.region = f.region;
  if (f.projectType) base.projectType = f.projectType;
  if (f.sourceChannel) base.sourceChannel = f.sourceChannel;
  if (f.budgetBand) base.budgetBand = f.budgetBand;
  return base;
}

/**
 * Stage counts and coarse transition rates inside the window (event-level, not deduped by project for counts).
 */
export async function getFunnelSummary(f: FunnelSummaryFilters): Promise<FunnelSummaryResult> {
  const where = buildFunnelWhere(f);
  const events = await db.leadFunnelEvent.findMany({
    where,
    select: {
      projectId: true,
      funnelStage: true,
      eventTimestamp: true,
    },
    orderBy: { eventTimestamp: "asc" },
  });

  const stageCounts: Record<string, number> = {};
  for (const s of FUNNEL_STAGES) stageCounts[s] = 0;

  const projectStages = new Map<string, Set<string>>();
  for (const e of events) {
    stageCounts[e.funnelStage] = (stageCounts[e.funnelStage] ?? 0) + 1;
    if (!projectStages.has(e.projectId)) projectStages.set(e.projectId, new Set());
    projectStages.get(e.projectId)!.add(e.funnelStage);
  }

  const projectsWithStage: Record<string, number> = {};
  for (const s of FUNNEL_STAGES) projectsWithStage[s] = 0;
  for (const stages of projectStages.values()) {
    for (const s of stages) {
      projectsWithStage[s] = (projectsWithStage[s] ?? 0) + 1;
    }
  }

  const rate = (num: number, den: number): number | null => (den > 0 ? num / den : null);

  const transitionRates: Record<string, number | null> = {
    project_to_recommendation: rate(
      [...projectStages.values()].filter((st) => st.has("project_created") && st.has("recommendation_generated"))
        .length,
      projectsWithStage.project_created || 0,
    ),
    recommendation_to_quote_requested: rate(
      [...projectStages.values()].filter((st) => st.has("recommendation_generated") && st.has("quote_requested"))
        .length,
      projectsWithStage.recommendation_generated || 0,
    ),
    quote_requested_to_received: rate(
      [...projectStages.values()].filter((st) => st.has("quote_requested") && st.has("quote_received")).length,
      projectsWithStage.quote_requested || 0,
    ),
    quote_received_to_accepted: rate(
      [...projectStages.values()].filter((st) => st.has("quote_received") && st.has("quote_accepted")).length,
      projectsWithStage.quote_received || 0,
    ),
    accepted_to_install_completed: rate(
      [...projectStages.values()].filter((st) => st.has("quote_accepted") && st.has("install_completed")).length,
      projectsWithStage.quote_accepted || 0,
    ),
  };

  const notes = [
    "Transition rates use distinct projects that reached both endpoints in any order historically tied to events in-window; backfilled stages may widen denominators.",
  ];

  return {
    window: { startIso: f.windowStart.toISOString(), endIso: f.windowEnd.toISOString() },
    filters: {
      region: f.region,
      projectType: f.projectType,
      sourceChannel: f.sourceChannel,
      budgetBand: f.budgetBand,
    },
    stageCounts,
    projectsWithStage,
    transitionRates,
    notes,
  };
}
