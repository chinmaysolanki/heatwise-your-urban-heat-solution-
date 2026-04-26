import { db } from "@/lib/db";
import type {
  CohortMetricsRow,
  CohortSlice,
  InstallerOutcomeByCohortRow,
  InstallerOutcomeSummary,
  RecommendationFunnelSummary,
} from "@/lib/adminAnalyticsTypes";
import { FEEDBACK_EVENT_TYPES } from "@/lib/recommendationTelemetryConstants";

const IMPRESSION_TYPES = new Set([
  "recommendation_impression",
  "recommendation_view",
  "candidate_viewed",
]);

const SELECT_TYPES = new Set(["recommendation_select", "candidate_selected"]);

function safeJson(s: string | null | undefined): Record<string, unknown> {
  if (!s) return {};
  try {
    const o = JSON.parse(s) as unknown;
    return typeof o === "object" && o !== null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function extractCohortFromSessionSnapshots(session: {
  projectSnapshotJson: string;
  preferenceSnapshotJson: string;
  environmentSnapshotJson: string;
}): CohortSlice {
  const project = safeJson(session.projectSnapshotJson);
  const pref = safeJson(session.preferenceSnapshotJson);
  const env = safeJson(session.environmentSnapshotJson);

  const projectType =
    String(project.projectType ?? project.type ?? project.spaceType ?? project.project_type ?? "unknown") || "unknown";
  const climateZone =
    String(
      env.climateZone ??
        env.climate_zone ??
        project.climateZone ??
        project.climate_zone ??
        "unknown",
    ) || "unknown";

  const br = pref.budgetRange ?? project.budgetRange;
  if (typeof br === "string" && br.trim()) {
    return { project_type: projectType, climate_zone: climateZone, budget_band: br.trim().toLowerCase() };
  }
  const inr = Number(pref.budget_inr ?? project.budget_inr ?? 0);
  let budget_band = "unspecified";
  if (Number.isFinite(inr) && inr > 0) {
    if (inr < 50_000) budget_band = "low_inr";
    else if (inr < 150_000) budget_band = "medium_inr";
    else budget_band = "high_inr";
  }
  return { project_type: projectType, climate_zone: climateZone, budget_band };
}

export type AdminDateWindow = { start: Date; end: Date };

export function parseAdminDateWindow(query: Record<string, string | string[] | undefined>): AdminDateWindow {
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const s = typeof query.start === "string" ? query.start : null;
  const e = typeof query.end === "string" ? query.end : null;
  const start = s ? new Date(s) : defaultStart;
  const end = e ? new Date(e) : now;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return { start: defaultStart, end: now };
  }
  return { start, end };
}

export async function fetchRecommendationFunnel(window: AdminDateWindow): Promise<RecommendationFunnelSummary> {
  const [sessionsGenerated, events] = await Promise.all([
    db.recommendationTelemetrySession.count({
      where: { generatedAt: { gte: window.start, lte: window.end } },
    }),
    db.recommendationTelemetryEvent.findMany({
      where: { eventTimestamp: { gte: window.start, lte: window.end } },
      select: { sessionId: true, eventType: true },
    }),
  ]);

  const bySession = new Map<string, Set<string>>();
  const eventTypeCounts: Record<string, number> = {};

  for (const ev of events) {
    eventTypeCounts[ev.eventType] = (eventTypeCounts[ev.eventType] ?? 0) + 1;
    if (!bySession.has(ev.sessionId)) bySession.set(ev.sessionId, new Set());
    bySession.get(ev.sessionId)!.add(ev.eventType);
  }

  const has = (types: Set<string>) => {
    let n = 0;
    for (const s of bySession.values()) {
      for (const t of types) {
        if (s.has(t)) {
          n++;
          break;
        }
      }
    }
    return n;
  };

  const hasType = (t: string) => {
    let n = 0;
    for (const s of bySession.values()) {
      if (s.has(t)) n++;
    }
    return n;
  };

  const impressionSessions = has(IMPRESSION_TYPES);
  const expandSessions = hasType("recommendation_expand");
  const saveSessions = hasType("recommendation_save");
  const selectSessions = has(SELECT_TYPES);
  const installerSessions = hasType("recommendation_request_installer");

  const installCompleted = await db.installOutcomeRecord.count({
    where: {
      createdAt: { gte: window.start, lte: window.end },
      installStatus: "completed",
    },
  });

  const unique_sessions = {
    sessions_generated: sessionsGenerated,
    impression: impressionSessions,
    expand: expandSessions,
    save: saveSessions,
    select: selectSessions,
    installer_request: installerSessions,
    install_completed: installCompleted,
  };

  const div = (a: number, b: number) => (b > 0 ? a / b : null);

  const rates_vs_impression: RecommendationFunnelSummary["rates_vs_impression"] = {
    impression_rate: div(impressionSessions, sessionsGenerated),
    expand_rate: div(expandSessions, impressionSessions),
    save_rate: div(saveSessions, impressionSessions),
    select_rate: div(selectSessions, impressionSessions),
    installer_request_rate: div(installerSessions, impressionSessions),
    install_completion_rate: div(installCompleted, impressionSessions),
  };

  const rates_vs_sessions = {
    impression_rate: div(impressionSessions, sessionsGenerated),
    expand_rate: div(expandSessions, sessionsGenerated),
    save_rate: div(saveSessions, sessionsGenerated),
    select_rate: div(selectSessions, sessionsGenerated),
    installer_request_rate: div(installerSessions, sessionsGenerated),
    install_completed_rate: div(installCompleted, sessionsGenerated),
  };

  for (const t of FEEDBACK_EVENT_TYPES) {
    if (eventTypeCounts[t] === undefined) eventTypeCounts[t] = 0;
  }

  return {
    unique_sessions,
    rates_vs_impression,
    rates_vs_sessions,
    event_type_counts: eventTypeCounts,
  };
}

export async function fetchInstallerOutcomeSummary(window: AdminDateWindow): Promise<InstallerOutcomeSummary> {
  const rows = await db.installOutcomeRecord.findMany({
    where: { createdAt: { gte: window.start, lte: window.end } },
    select: {
      installStatus: true,
      userSatisfactionScore: true,
      installerFeasibilityRating: true,
      measuredTempChangeC: true,
      plantSurvivalRate30d: true,
      plantSurvivalRate90d: true,
    },
  });

  const by_status: Record<string, number> = {};
  const sat: number[] = [];
  const feas: number[] = [];
  const temp: number[] = [];
  const p30: number[] = [];
  const p90: number[] = [];

  for (const r of rows) {
    by_status[r.installStatus] = (by_status[r.installStatus] ?? 0) + 1;
    if (r.userSatisfactionScore != null) sat.push(r.userSatisfactionScore);
    if (r.installerFeasibilityRating != null) feas.push(r.installerFeasibilityRating);
    if (r.measuredTempChangeC != null) temp.push(r.measuredTempChangeC);
    if (r.plantSurvivalRate30d != null) p30.push(r.plantSurvivalRate30d);
    if (r.plantSurvivalRate90d != null) p90.push(r.plantSurvivalRate90d);
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  return {
    by_status,
    completed_count: by_status.completed ?? 0,
    avg_user_satisfaction: avg(sat),
    avg_installer_feasibility: avg(feas),
    avg_measured_temp_change_c: avg(temp),
    avg_plant_survival_30d: avg(p30),
    avg_plant_survival_90d: avg(p90),
  };
}

function cohortKey(c: CohortSlice): string {
  return `${c.project_type}\t${c.climate_zone}\t${c.budget_band}`;
}

export async function fetchCohortMetrics(window: AdminDateWindow): Promise<CohortMetricsRow[]> {
  const events = await db.recommendationTelemetryEvent.findMany({
    where: { eventTimestamp: { gte: window.start, lte: window.end } },
    select: {
      sessionId: true,
      eventType: true,
      session: {
        select: {
          projectSnapshotJson: true,
          preferenceSnapshotJson: true,
          environmentSnapshotJson: true,
        },
      },
    },
  });

  const cohortBySession = new Map<string, CohortSlice>();
  const sessionEventTypes = new Map<string, Set<string>>();

  for (const ev of events) {
    if (!sessionEventTypes.has(ev.sessionId)) sessionEventTypes.set(ev.sessionId, new Set());
    sessionEventTypes.get(ev.sessionId)!.add(ev.eventType);
    if (!cohortBySession.has(ev.sessionId)) {
      cohortBySession.set(ev.sessionId, extractCohortFromSessionSnapshots(ev.session));
    }
  }

  const agg = new Map<
    string,
    { cohort: CohortSlice; sessions: Set<string>; impressions: number; selects: number; inst: number }
  >();

  for (const [sid, types] of sessionEventTypes) {
    const cohort = cohortBySession.get(sid)!;
    const key = cohortKey(cohort);
    if (!agg.has(key)) {
      agg.set(key, {
        cohort,
        sessions: new Set(),
        impressions: 0,
        selects: 0,
        inst: 0,
      });
    }
    const row = agg.get(key)!;
    row.sessions.add(sid);
    if ([...types].some((t) => IMPRESSION_TYPES.has(t))) row.impressions += 1;
    if ([...types].some((t) => SELECT_TYPES.has(t))) row.selects += 1;
    if (types.has("recommendation_request_installer")) row.inst += 1;
  }

  const installRows = await db.installOutcomeRecord.findMany({
    where: {
      createdAt: { gte: window.start, lte: window.end },
      installStatus: "completed",
      telemetrySessionId: { not: null },
    },
    select: { telemetrySessionId: true },
  });

  const installCountByCohort = new Map<string, number>();
  const sessionIdsForInstall = [...new Set(installRows.map((r) => r.telemetrySessionId!))];
  if (sessionIdsForInstall.length) {
    const sessions = await db.recommendationTelemetrySession.findMany({
      where: { id: { in: sessionIdsForInstall } },
      select: {
        id: true,
        projectSnapshotJson: true,
        preferenceSnapshotJson: true,
        environmentSnapshotJson: true,
      },
    });
    for (const s of sessions) {
      const c = extractCohortFromSessionSnapshots(s);
      const k = cohortKey(c);
      installCountByCohort.set(k, (installCountByCohort.get(k) ?? 0) + 1);
    }
  }

  const out: CohortMetricsRow[] = [];
  for (const [, v] of agg) {
    const k = cohortKey(v.cohort);
    out.push({
      ...v.cohort,
      sessions: v.sessions.size,
      impressions: v.impressions,
      selects: v.selects,
      installer_requests: v.inst,
      installs_completed: installCountByCohort.get(k) ?? 0,
    });
  }
  return out.sort((a, b) => b.sessions - a.sessions);
}

export async function countSessionsAndEvents(window: AdminDateWindow): Promise<{
  sessions: number;
  events: number;
}> {
  const [sessions, events] = await Promise.all([
    db.recommendationTelemetrySession.count({
      where: { generatedAt: { gte: window.start, lte: window.end } },
    }),
    db.recommendationTelemetryEvent.count({
      where: { eventTimestamp: { gte: window.start, lte: window.end } },
    }),
  ]);
  return { sessions, events };
}

export async function fetchInstallerOutcomesByCohort(window: AdminDateWindow): Promise<InstallerOutcomeByCohortRow[]> {
  const rows = await db.installOutcomeRecord.findMany({
    where: { createdAt: { gte: window.start, lte: window.end } },
    select: {
      installStatus: true,
      userSatisfactionScore: true,
      measuredTempChangeC: true,
      telemetrySession: {
        select: {
          projectSnapshotJson: true,
          preferenceSnapshotJson: true,
          environmentSnapshotJson: true,
        },
      },
    },
  });

  type Acc = {
    cohort: CohortSlice;
    n: number;
    completed: number;
    sat: number[];
    temp: number[];
  };
  const m = new Map<string, Acc>();

  for (const r of rows) {
    const session = r.telemetrySession;
    const cohort = session
      ? extractCohortFromSessionSnapshots(session)
      : { project_type: "unknown", climate_zone: "unknown", budget_band: "unspecified" };
    const key = cohortKey(cohort);
    if (!m.has(key)) {
      m.set(key, { cohort, n: 0, completed: 0, sat: [], temp: [] });
    }
    const a = m.get(key)!;
    a.n += 1;
    if (r.installStatus === "completed") a.completed += 1;
    if (r.userSatisfactionScore != null) a.sat.push(r.userSatisfactionScore);
    if (r.measuredTempChangeC != null) a.temp.push(r.measuredTempChangeC);
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : null);

  return [...m.values()]
    .map((a) => ({
      ...a.cohort,
      outcome_count: a.n,
      completed_count: a.completed,
      avg_user_satisfaction: avg(a.sat),
      avg_measured_temp_change_c: avg(a.temp),
    }))
    .sort((x, y) => y.outcome_count - x.outcome_count);
}
