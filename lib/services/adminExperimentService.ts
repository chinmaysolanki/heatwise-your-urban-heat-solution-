import fs from "fs";
import path from "path";

import type { ExperimentSummaryPayload, ExperimentVariantMetrics } from "@/lib/adminAnalyticsTypes";
import { loadExperimentsFile } from "@/lib/services/experimentAssignmentService";
import { db } from "@/lib/db";

import type { AdminDateWindow } from "@/lib/services/adminAnalyticsService";

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * v1: treat `generatorSource` + `rulesVersion` as experiment variant axes (DB has no experiment_id yet).
 * Overlay evaluation JSONL stats when files exist (see `ml/evaluation`).
 */
export async function fetchExperimentSummary(window: AdminDateWindow): Promise<ExperimentSummaryPayload> {
  const sessions = await db.recommendationTelemetrySession.findMany({
    where: { generatedAt: { gte: window.start, lte: window.end } },
    select: {
      id: true,
      generatorSource: true,
      rulesVersion: true,
      latencyMs: true,
    },
  });

  const sessionIds = sessions.map((s) => s.id);
  const eventAgg = new Map<string, { impression: number; select: number; installer: number }>();

  if (sessionIds.length) {
    const evs = await db.recommendationTelemetryEvent.groupBy({
      by: ["sessionId", "eventType"],
      where: {
        sessionId: { in: sessionIds },
        eventTimestamp: { gte: window.start, lte: window.end },
        eventType: {
          in: [
            "recommendation_impression",
            "recommendation_view",
            "candidate_viewed",
            "recommendation_select",
            "candidate_selected",
            "recommendation_request_installer",
          ],
        },
      },
      _count: { _all: true },
    });

    for (const row of evs) {
      if (!eventAgg.has(row.sessionId)) {
        eventAgg.set(row.sessionId, { impression: 0, select: 0, installer: 0 });
      }
      const a = eventAgg.get(row.sessionId)!;
      const c = row._count._all;
      if (
        row.eventType === "recommendation_impression" ||
        row.eventType === "recommendation_view" ||
        row.eventType === "candidate_viewed"
      ) {
        a.impression += c;
      } else if (row.eventType === "recommendation_select" || row.eventType === "candidate_selected") {
        a.select += c;
      } else if (row.eventType === "recommendation_request_installer") {
        a.installer += c;
      }
    }
  }

  const byVariant = new Map<string, ExperimentVariantMetrics>();

  for (const s of sessions) {
    const key = `${s.generatorSource}::${s.rulesVersion}`;
    if (!byVariant.has(key)) {
      byVariant.set(key, {
        variant_key: key,
        session_count: 0,
        generator_source_mix: {},
        rules_version_mix: {},
        median_latency_ms: null,
        impression_count: 0,
        select_count: 0,
        installer_request_count: 0,
      });
    }
    const v = byVariant.get(key)!;
    v.session_count += 1;
    v.generator_source_mix[s.generatorSource] = (v.generator_source_mix[s.generatorSource] ?? 0) + 1;
    v.rules_version_mix[s.rulesVersion] = (v.rules_version_mix[s.rulesVersion] ?? 0) + 1;
    const ea = eventAgg.get(s.id);
    if (ea) {
      v.impression_count += ea.impression;
      v.select_count += ea.select;
      v.installer_request_count += ea.installer;
    }
  }

  for (const v of byVariant.values()) {
    const latencies = sessions.filter((s) => `${s.generatorSource}::${s.rulesVersion}` === v.variant_key).map((s) => s.latencyMs);
    v.median_latency_ms = median(latencies);
  }

  const expFile = loadExperimentsFile();
  const from_evaluation_files: ExperimentSummaryPayload["from_evaluation_files"] = {
    notes: "Counts lines in runtime_evaluations.jsonl if present; align with evaluation layer.",
  };
  const dataDir = process.env.HEATWISE_EVALUATION_DATA_DIR ?? path.join(process.cwd(), "ml/evaluation/data");
  const evalPath = path.join(dataDir, "runtime_evaluations.jsonl");
  if (fs.existsSync(evalPath)) {
    const text = fs.readFileSync(evalPath, "utf8");
    const lines = text.trim() ? text.trim().split("\n").length : 0;
    from_evaluation_files.runtime_evaluations_lines = lines;
    from_evaluation_files.path = evalPath;
  }
  from_evaluation_files.notes = `Active experiment definitions: ${expFile.experiments.filter((e) => e.status === "active").length} active of ${expFile.experiments.length} total.`;

  return {
    by_variant: [...byVariant.values()].sort((a, b) => b.session_count - a.session_count),
    from_evaluation_files,
  };
}
