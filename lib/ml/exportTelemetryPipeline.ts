/**
 * Prisma → ml/live_data pipeline shapes (Phase 7+) + legacy RecommendationFeedbackEvent bridge.
 * Output keys use snake_case (and camelCase aliases) for Python export scripts.
 */

import { createHash } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { HW_TELEMETRY_SCHEMA_VERSION, LEGACY_TO_CANONICAL } from "@/lib/recommendationTelemetryCanonical";

export type TelemetryTrainingAudit = {
  recommendationRunCount: number;
  recommendationCandidateCount: number;
  recommendationTelemetryEventCount: number;
  recommendationCandidateSnapshotCount: number;
  recommendationTelemetrySessionCount: number;
  recommendationFeedbackEventLegacyCount: number;
  installOutcomeCount: number;
  /** SQLite: COALESCE(TRIM(json_extract(metadataJson,'$.canonicalEvent')), eventType) */
  byEffectiveCanonicalOrEventType: Record<string, number>;
  telemetryWithRecommendationRunId: number;
  snapshotsWithSpeciesCodes: number;
  candidatesWithSpeciesId: number;
  candidatesWithSpeciesCatalogCode: number;
};

const LEGACY_ACTION_TO_EVENT_TYPE: Record<string, string> = {
  view: "recommendation_view",
  dismiss: "recommendation_dismiss",
  mark_installed: "recommendation_request_installer",
  select: "recommendation_select",
  save: "recommendation_save",
  positive: "recommendation_feedback_positive",
  negative: "recommendation_feedback_negative",
};

function stableId(prefix: string, parts: string[]): string {
  const h = createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 24);
  return `${prefix}_${h}`;
}

function parseExtra(extra: string | null): Record<string, unknown> {
  if (!extra?.trim()) return {};
  try {
    const o = JSON.parse(extra) as unknown;
    return typeof o === "object" && o !== null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function legacyFeedbackActionToEventType(action: string): string {
  return LEGACY_ACTION_TO_EVENT_TYPE[action] ?? `legacy_feedback_${action}`;
}

export type LegacyBridgeExport = {
  recommendation_sessions: Record<string, unknown>[];
  candidate_snapshots: Record<string, unknown>[];
  feedback_events: Record<string, unknown>[];
};

type LegacyRow = {
  eventId: string;
  userId: string | null;
  recommendationId: string;
  projectId: string | null;
  action: string;
  timestamp: Date;
  dwellMs: number | null;
  candidateId: string | null;
  extra: string | null;
};

/**
 * Synthetic telemetry session + snapshots + events for legacy /api/recommendation-feedback rows.
 * One session per (projectId, recommendationId); snapshot per distinct candidate key within that session.
 */
export function buildLegacyFeedbackBridgeRows(events: LegacyRow[]): LegacyBridgeExport {
  const sessionMap = new Map<string, Record<string, unknown>>();
  const snapshotMap = new Map<string, { row: Record<string, unknown>; sessionId: string }>();
  const feedback_events: Record<string, unknown>[] = [];

  for (const ev of events) {
    const projectId = ev.projectId?.trim();
    if (!projectId) continue;
    const recommendationId = ev.recommendationId?.trim() || "unknown";
    const sessionId = stableId("lfb_sess", [projectId, recommendationId]);
    const candKey = ev.candidateId?.trim() ?? "default";
    const snapId = stableId("lfb_snap", [projectId, recommendationId, candKey]);

    if (!sessionMap.has(sessionId)) {
      sessionMap.set(sessionId, {
        recommendation_session_id: sessionId,
        id: sessionId,
        project_id: projectId,
        user_id: ev.userId,
        photo_session_id: null,
        model_version: "legacy_feedback_bridge_v1",
        rules_version: "legacy_feedback_bridge_v1",
        generator_source: "legacy_recommendation_feedback",
        project_snapshot_json: JSON.stringify({ bridged: true, recommendationId }),
        environment_snapshot_json: "{}",
        preference_snapshot_json: "{}",
        total_candidates: 1,
        latency_ms: 0,
        legacy_recommendation_run_id: null,
        legacyRecommendationRunId: null,
      });
    }

    if (!snapshotMap.has(snapId)) {
      snapshotMap.set(snapId, {
        sessionId,
        row: {
          id: snapId,
          candidate_snapshot_id: snapId,
          session_id: sessionId,
          sessionId,
          candidate_rank: 0,
          candidate_source: "legacy_recommendation_feedback",
          candidate_payload_json: JSON.stringify({
            bridged: true,
            recommendationId,
            legacyCandidateId: ev.candidateId,
            legacy: true,
          }),
          species_payload_json: JSON.stringify({
            schema: "hw_species_identity_v1",
            speciesCatalogCodes: [] as string[],
          }),
          speciesPayloadJson: null,
        },
      });
    }

    const extra = parseExtra(ev.extra);
    const codesFromExtra = Array.isArray(extra.speciesCatalogCodes)
      ? (extra.speciesCatalogCodes as unknown[]).filter((x): x is string => typeof x === "string")
      : [];

    if (codesFromExtra.length) {
      const snap = snapshotMap.get(snapId)!;
      snap.row.species_payload_json = JSON.stringify({
        schema: "hw_species_identity_v1",
        speciesCatalogCodes: codesFromExtra,
      });
    }

    const legacyEt = legacyFeedbackActionToEventType(ev.action);
    const canonicalEvent = LEGACY_TO_CANONICAL[legacyEt] ?? legacyEt;
    const metadata: Record<string, unknown> = {
      schema: HW_TELEMETRY_SCHEMA_VERSION,
      canonicalEvent,
      projectId,
      candidateSnapshotId: snapId,
      speciesCatalogCodes: codesFromExtra.length ? codesFromExtra : undefined,
      source: "legacy_recommendation_feedback",
      legacyAction: ev.action,
      legacyRecommendationId: ev.recommendationId,
    };
    if (LEGACY_TO_CANONICAL[legacyEt]) metadata.legacyEventType = legacyEt;
    if (typeof extra.screen === "string") metadata.heatwiseSurface = extra.screen;

    feedback_events.push({
      feedback_event_id: `legacy_${ev.eventId}`,
      recommendation_session_id: sessionId,
      session_id: sessionId,
      sessionId,
      candidate_snapshot_id: snapId,
      candidateSnapshotId: snapId,
      project_id: projectId,
      projectId,
      user_id: ev.userId,
      event_type: legacyEt,
      eventType: legacyEt,
      event_timestamp: ev.timestamp.toISOString(),
      event_source: "legacy_recommendation_feedback",
      screen_name: typeof extra.screen === "string" ? extra.screen : null,
      ui_position: typeof extra.rank === "number" ? extra.rank : null,
      dwell_time_ms: ev.dwellMs,
      metadata_json: JSON.stringify(metadata),
    });
  }

  const bySessionSnaps = new Map<string, Record<string, unknown>[]>();
  for (const { sessionId, row } of snapshotMap.values()) {
    if (!bySessionSnaps.has(sessionId)) bySessionSnaps.set(sessionId, []);
    bySessionSnaps.get(sessionId)!.push(row);
  }
  for (const [sid, snaps] of bySessionSnaps) {
    snaps.sort((a, b) => String(a.candidate_snapshot_id).localeCompare(String(b.candidate_snapshot_id)));
    snaps.forEach((row, i) => {
      row.candidate_rank = i + 1;
    });
    const sess = sessionMap.get(sid);
    if (sess) sess.total_candidates = snaps.length;
  }

  return {
    recommendation_sessions: [...sessionMap.values()],
    candidate_snapshots: [...snapshotMap.values()].map((x) => x.row),
    feedback_events,
  };
}

function telemetryEventToExportRow(ev: {
  feedbackEventId: string;
  sessionId: string;
  candidateSnapshotId: string | null;
  projectId: string;
  userId: string | null;
  eventType: string;
  eventTimestamp: Date;
  eventSource: string;
  screenName: string | null;
  uiPosition: number | null;
  dwellTimeMs: number | null;
  metadataJson: string | null;
  recommendationRunId: string | null;
}) {
  return {
    feedback_event_id: ev.feedbackEventId,
    recommendation_session_id: ev.sessionId,
    session_id: ev.sessionId,
    sessionId: ev.sessionId,
    candidate_snapshot_id: ev.candidateSnapshotId,
    candidateSnapshotId: ev.candidateSnapshotId,
    project_id: ev.projectId,
    projectId: ev.projectId,
    user_id: ev.userId,
    event_type: ev.eventType,
    eventType: ev.eventType,
    event_timestamp: ev.eventTimestamp.toISOString(),
    event_source: ev.eventSource,
    screen_name: ev.screenName,
    ui_position: ev.uiPosition,
    dwell_time_ms: ev.dwellTimeMs,
    metadata_json: ev.metadataJson,
    recommendation_run_id: ev.recommendationRunId,
    recommendationRunId: ev.recommendationRunId,
  };
}

function telemetrySessionToExportRow(s: {
  id: string;
  projectId: string;
  userId: string | null;
  photoSessionId: string | null;
  modelVersion: string;
  rulesVersion: string;
  generatorSource: string;
  projectSnapshotJson: string;
  environmentSnapshotJson: string;
  preferenceSnapshotJson: string;
  totalCandidates: number;
  latencyMs: number;
  legacyRecommendationRunId: string | null;
}) {
  return {
    recommendation_session_id: s.id,
    id: s.id,
    project_id: s.projectId,
    user_id: s.userId,
    photo_session_id: s.photoSessionId,
    model_version: s.modelVersion,
    rules_version: s.rulesVersion,
    generator_source: s.generatorSource,
    project_snapshot_json: s.projectSnapshotJson,
    environment_snapshot_json: s.environmentSnapshotJson,
    preference_snapshot_json: s.preferenceSnapshotJson,
    total_candidates: s.totalCandidates,
    latency_ms: s.latencyMs,
    legacy_recommendation_run_id: s.legacyRecommendationRunId,
    legacyRecommendationRunId: s.legacyRecommendationRunId,
  };
}

function snapshotToExportRow(c: {
  id: string;
  sessionId: string;
  candidateRank: number;
  candidateSource: string;
  candidatePayloadJson: string;
  speciesPayloadJson: string | null;
}) {
  return {
    id: c.id,
    candidate_snapshot_id: c.id,
    session_id: c.sessionId,
    sessionId: c.sessionId,
    candidate_rank: c.candidateRank,
    candidate_source: c.candidateSource,
    candidate_payload_json: c.candidatePayloadJson,
    species_payload_json: c.speciesPayloadJson,
    speciesPayloadJson: c.speciesPayloadJson,
  };
}

function installOutcomeToExportRow(o: {
  id: string;
  projectId: string;
  userId: string | null;
  telemetrySessionId: string | null;
  selectedCandidateSnapshotId: string | null;
  installStatus: string;
  installDate: Date | null;
  userSatisfactionScore: number | null;
  measuredTempChangeC: number | null;
  plantSurvivalRate90d: number | null;
}) {
  return {
    id: o.id,
    project_id: o.projectId,
    user_id: o.userId,
    telemetry_session_id: o.telemetrySessionId,
    telemetrySessionId: o.telemetrySessionId,
    selected_candidate_snapshot_id: o.selectedCandidateSnapshotId,
    selectedCandidateSnapshotId: o.selectedCandidateSnapshotId,
    install_status: o.installStatus,
    installStatus: o.installStatus,
    install_date: o.installDate?.toISOString() ?? null,
    installDate: o.installDate?.toISOString() ?? null,
    user_satisfaction_score: o.userSatisfactionScore,
    measured_temp_change_c: o.measuredTempChangeC,
    plant_survival_rate_90d: o.plantSurvivalRate90d,
  };
}

function csvEscapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]!);
  const header = keys.join(",");
  const lines = rows.map((r) => keys.map((k) => csvEscapeCell(r[k])).join(","));
  return `${header}\n${lines.join("\n")}\n`;
}

export async function runTelemetryTrainingAudit(prisma: PrismaClient): Promise<TelemetryTrainingAudit> {
  const [
    recommendationRunCount,
    recommendationCandidateCount,
    recommendationTelemetryEventCount,
    recommendationCandidateSnapshotCount,
    recommendationTelemetrySessionCount,
    recommendationFeedbackEventLegacyCount,
    installOutcomeCount,
    candidatesWithSpeciesId,
  ] = await Promise.all([
    prisma.recommendationRun.count(),
    prisma.recommendationCandidate.count(),
    prisma.recommendationTelemetryEvent.count(),
    prisma.recommendationCandidateSnapshot.count(),
    prisma.recommendationTelemetrySession.count(),
    prisma.recommendationFeedbackEvent.count(),
    prisma.installOutcomeRecord.count(),
    prisma.recommendationCandidate.count({ where: { speciesId: { not: null } } }),
  ]);

  let telemetryWithRecommendationRunId = 0;
  try {
    telemetryWithRecommendationRunId = await prisma.recommendationTelemetryEvent.count({
      where: { recommendationRunId: { not: null } },
    });
  } catch {
    telemetryWithRecommendationRunId = 0;
  }

  let candidatesWithSpeciesCatalogCode = 0;
  try {
    candidatesWithSpeciesCatalogCode = await prisma.recommendationCandidate.count({
      where: {
        AND: [{ speciesCatalogCode: { not: null } }, { speciesCatalogCode: { not: "" } }],
      },
    });
  } catch {
    candidatesWithSpeciesCatalogCode = 0;
  }

  const snapSpeciesRows = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*) AS n FROM RecommendationCandidateSnapshot
    WHERE speciesPayloadJson IS NOT NULL
    AND speciesPayloadJson != ''
    AND json_extract(speciesPayloadJson, '$.speciesCatalogCodes') IS NOT NULL
    AND json_array_length(json_extract(speciesPayloadJson, '$.speciesCatalogCodes')) > 0
  `.catch(() => [{ n: BigInt(0) }]);

  const effectiveRows = await prisma.$queryRaw<Array<{ effective: string; ct: bigint }>>`
    SELECT
      COALESCE(
        NULLIF(TRIM(json_extract(metadataJson, '$.canonicalEvent')), ''),
        eventType
      ) AS effective,
      COUNT(*) AS ct
    FROM RecommendationTelemetryEvent
    GROUP BY effective
  `.catch(() => [] as Array<{ effective: string; ct: bigint }>);

  const byEffectiveCanonicalOrEventType: Record<string, number> = {};
  for (const r of effectiveRows) {
    const k = r.effective ?? "__null__";
    byEffectiveCanonicalOrEventType[k] = Number(r.ct);
  }

  return {
    recommendationRunCount,
    recommendationCandidateCount,
    recommendationTelemetryEventCount,
    recommendationCandidateSnapshotCount,
    recommendationTelemetrySessionCount,
    recommendationFeedbackEventLegacyCount,
    installOutcomeCount,
    byEffectiveCanonicalOrEventType,
    telemetryWithRecommendationRunId,
    snapshotsWithSpeciesCodes: Number(snapSpeciesRows[0]?.n ?? 0),
    candidatesWithSpeciesId,
    candidatesWithSpeciesCatalogCode,
  };
}

export type ExportTelemetryPipelineOptions = {
  outDir: string;
  /** Merge bridged legacy RecommendationFeedbackEvent rows into export */
  includeLegacyBridge: boolean;
  writeCsv: boolean;
};

export async function exportTelemetryPipelineForMl(
  prisma: PrismaClient,
  options: ExportTelemetryPipelineOptions,
): Promise<{ jsonlDir: string; csvDir: string }> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const jsonlDir = path.resolve(options.outDir, "jsonl");
  const csvDir = path.resolve(options.outDir, "csv");
  await fs.mkdir(jsonlDir, { recursive: true });
  await fs.mkdir(csvDir, { recursive: true });

  const sessions = await prisma.recommendationTelemetrySession.findMany();
  const snaps = await prisma.recommendationCandidateSnapshot.findMany();
  const events = await prisma.recommendationTelemetryEvent.findMany();
  const outcomes = await prisma.installOutcomeRecord.findMany();

  let sessionRows = sessions.map(telemetrySessionToExportRow) as Record<string, unknown>[];
  let snapRows = snaps.map(snapshotToExportRow) as Record<string, unknown>[];
  let eventRows = events.map(telemetryEventToExportRow) as Record<string, unknown>[];
  const outcomeRows = outcomes.map(installOutcomeToExportRow) as Record<string, unknown>[];

  if (options.includeLegacyBridge) {
    const legacy = await prisma.recommendationFeedbackEvent.findMany({ orderBy: { timestamp: "asc" } });
    const bridge = buildLegacyFeedbackBridgeRows(legacy);
    sessionRows = sessionRows.concat(bridge.recommendation_sessions);
    snapRows = snapRows.concat(bridge.candidate_snapshots);
    eventRows = eventRows.concat(bridge.feedback_events);
  }

  async function writeJsonl(name: string, rows: Record<string, unknown>[]) {
    const p = path.join(jsonlDir, name);
    const body = rows.length ? rows.map((r) => JSON.stringify(r)).join("\n") + "\n" : "";
    await fs.writeFile(p, body, "utf8");
  }

  await writeJsonl("recommendation_sessions.jsonl", sessionRows);
  await writeJsonl("candidate_snapshots.jsonl", snapRows);
  await writeJsonl("feedback_events.jsonl", eventRows);
  await writeJsonl("install_outcomes.jsonl", outcomeRows);

  if (options.writeCsv) {
    await fs.writeFile(path.join(csvDir, "recommendation_sessions.csv"), rowsToCsv(sessionRows), "utf8");
    await fs.writeFile(path.join(csvDir, "candidate_snapshots.csv"), rowsToCsv(snapRows), "utf8");
    await fs.writeFile(path.join(csvDir, "feedback_events.csv"), rowsToCsv(eventRows), "utf8");
    await fs.writeFile(path.join(csvDir, "install_outcomes.csv"), rowsToCsv(outcomeRows), "utf8");
  }

  return { jsonlDir, csvDir };
}
