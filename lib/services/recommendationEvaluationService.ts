import fs from "fs";
import path from "path";

import type { RecommendationGenerateResponse, RuntimeCandidate } from "@/lib/ml/recommendationRuntimeTypes";
import type { AssignmentPayload, RequestLevelEvaluationSummary } from "@/lib/ml/evaluationTypes";

function evaluationDataDir(): string {
  return process.env.HEATWISE_EVALUATION_DATA_DIR ?? path.join(process.cwd(), "ml/evaluation/data");
}

function candidateIds(cands: RuntimeCandidate[]): string[] {
  return cands.map((c) => c.candidateId);
}

function topKOverlap(a: string[], b: string[], k: number): number {
  const sa = new Set(a.slice(0, k));
  const sb = new Set(b.slice(0, k));
  let n = 0;
  for (const x of sa) {
    if (sb.has(x)) n++;
  }
  return n;
}

function averageRankShift(primaryIds: string[], shadowIds: string[], topN: number): number {
  const rankB = new Map(shadowIds.map((id, i) => [id, i]));
  const deltas: number[] = [];
  for (let i = 0; i < Math.min(topN, primaryIds.length); i++) {
    const id = primaryIds[i];
    const j = rankB.get(id);
    if (j !== undefined) deltas.push(Math.abs(j - i));
  }
  if (!deltas.length) return 0;
  return deltas.reduce((s, x) => s + x, 0) / deltas.length;
}

function numFromPayload(c: RuntimeCandidate, keys: string[]): number | null {
  const p = c.candidatePayload as Record<string, unknown>;
  for (const k of keys) {
    const v = p[k];
    if (v === undefined || v === null) continue;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

export function evaluatePrimaryVsShadow(
  primary: RecommendationGenerateResponse,
  shadow: RecommendationGenerateResponse | null,
  meta: {
    experimentId: string | null;
    assignment: AssignmentPayload | null;
    primaryLatencyMs?: number | null;
    shadowLatencyMs?: number | null;
  },
): RequestLevelEvaluationSummary {
  if (!shadow) {
    return {
      experiment_id: meta.experimentId,
      assigned_variant: meta.assignment?.assigned_variant ?? null,
      served_variant: meta.assignment?.served_variant ?? null,
      exact_top1_match: false,
      top3_overlap_count: 0,
      average_rank_shift: 0,
      expected_temp_reduction_delta: null,
      expected_install_cost_delta: null,
      feasibility_delta: null,
      safety_delta: null,
      filtered_candidate_count_delta: 0,
      latency_delta_ms: null,
      rules_version_primary: primary.telemetryMeta?.rulesVersion,
      rules_version_shadow: undefined,
      shadow_compute_failed: true,
    };
  }

  const pIds = candidateIds(primary.candidates ?? []);
  const sIds = candidateIds(shadow.candidates ?? []);
  const exact = Boolean(pIds.length && sIds.length && pIds[0] === sIds[0]);
  const top3 = topKOverlap(pIds, sIds, 3);
  const avgShift = averageRankShift(pIds, sIds, 10);

  const pc0 = primary.candidates?.[0];
  const sc0 = shadow.candidates?.[0];

  const tempP = pc0 ? numFromPayload(pc0, ["expected_temp_reduction_c", "cooling_delta_c", "temp_reduction_c"]) : null;
  const tempS = sc0 ? numFromPayload(sc0, ["expected_temp_reduction_c", "cooling_delta_c", "temp_reduction_c"]) : null;
  const costP = pc0 ? numFromPayload(pc0, ["estimated_install_cost", "install_cost_usd", "cost_estimate"]) : null;
  const costS = sc0 ? numFromPayload(sc0, ["estimated_install_cost", "install_cost_usd", "cost_estimate"]) : null;
  const feasP = pc0 ? numFromPayload(pc0, ["feasibility_score", "feasibility"]) : null;
  const feasS = sc0 ? numFromPayload(sc0, ["feasibility_score", "feasibility"]) : null;
  const safeP = pc0 ? numFromPayload(pc0, ["safety_score", "safety"]) : null;
  const safeS = sc0 ? numFromPayload(sc0, ["safety_score", "safety"]) : null;

  let latencyDelta: number | null = null;
  if (meta.primaryLatencyMs != null && meta.shadowLatencyMs != null) {
    latencyDelta = meta.shadowLatencyMs - meta.primaryLatencyMs;
  }

  return {
    experiment_id: meta.experimentId,
    assigned_variant: meta.assignment?.assigned_variant ?? null,
    served_variant: meta.assignment?.served_variant ?? null,
    exact_top1_match: exact,
    top3_overlap_count: top3,
    average_rank_shift: avgShift,
    expected_temp_reduction_delta:
      tempP != null && tempS != null ? tempS - tempP : null,
    expected_install_cost_delta:
      costP != null && costS != null ? costS - costP : null,
    feasibility_delta: feasP != null && feasS != null ? feasS - feasP : null,
    safety_delta: safeP != null && safeS != null ? safeS - safeP : null,
    filtered_candidate_count_delta: (shadow.candidates?.length ?? 0) - (primary.candidates?.length ?? 0),
    latency_delta_ms: latencyDelta,
    rules_version_primary: primary.telemetryMeta?.rulesVersion,
    rules_version_shadow: shadow.telemetryMeta?.rulesVersion,
    shadow_compute_failed: false,
  };
}

export function appendRuntimeEvaluation(record: RequestLevelEvaluationSummary & { logged_at?: string }): void {
  const dir = evaluationDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "runtime_evaluations.jsonl");
  const row = {
    logged_at: new Date().toISOString(),
    ...record,
  };
  fs.appendFileSync(file, `${JSON.stringify(row)}\n`, "utf8");
}

export function readRecentRuntimeEvaluations(maxLines: number): unknown[] {
  const file = path.join(evaluationDataDir(), "runtime_evaluations.jsonl");
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8");
  const lines = text.trim().split("\n").filter(Boolean);
  const tail = lines.slice(-maxLines);
  return tail.map((l) => JSON.parse(l) as unknown);
}
