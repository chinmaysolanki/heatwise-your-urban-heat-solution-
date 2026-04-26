/**
 * Summarize recommendation API responses for quality evaluation reports.
 */

import type { RecommendationGenerateResponse, RuntimeCandidate } from "@/lib/ml/recommendationRuntimeTypes";

const HARD_PREFIX = "HARD_";

export type HardConstraintSummary = {
  /** Open candidates carrying any HARD_* reason (should normally be 0). */
  open_with_hard_reasons: number;
  /** Blocked candidates with at least one HARD_* reason. */
  blocked_with_hard_reasons: number;
  /** True when no open candidate lists a HARD_* block reason. */
  pass: boolean;
};

export type TopOpenSpeciesRow = {
  rank: number;
  name: string;
  catalog_code: string | null;
};

export type ScenarioEvaluationRow = {
  scenario_id: string;
  scenario_title: string;
  http_status: number;
  error_message?: string;
  mode?: string;
  generator_source?: string;
  rules_version?: string;
  ml_errors_preview: string[];
  top_open_species: TopOpenSpeciesRow[];
  layout_slate_status?: string;
  layout_eligible?: boolean;
  layout_attached: boolean;
  layout_failure_code?: string | null;
  candidate_counts: { total: number; open: number; blocked: number };
  /** Share of open candidates with non-empty species_catalog_code (null if no open). */
  species_catalog_code_coverage_open: number | null;
  unresolved_open_count: number;
  hard_constraint_summary: HardConstraintSummary;
};

export type EvaluationReportPayload = {
  schema_version: "heatwise.recommendation_eval.v1";
  generated_at: string;
  python_stubbed: boolean;
  rows: ScenarioEvaluationRow[];
};

function isHardReason(reason: string): boolean {
  return reason.includes(HARD_PREFIX);
}

function hardSummaryForCandidates(candidates: RuntimeCandidate[]): HardConstraintSummary {
  let open_with_hard_reasons = 0;
  let blocked_with_hard_reasons = 0;
  for (const c of candidates) {
    const reasons = (c.blockReasons ?? []).map(String);
    const hasHard = reasons.some(isHardReason);
    if (c.blocked) {
      if (hasHard) blocked_with_hard_reasons += 1;
    } else if (reasons.some(isHardReason)) {
      open_with_hard_reasons += 1;
    }
  }
  return {
    open_with_hard_reasons,
    blocked_with_hard_reasons,
    pass: open_with_hard_reasons === 0,
  };
}

function topOpenSpecies(candidates: RuntimeCandidate[], limit: number): TopOpenSpeciesRow[] {
  const open = candidates.filter((c) => !c.blocked).sort((a, b) => a.rank - b.rank);
  return open.slice(0, limit).map((c) => {
    const p = c.candidatePayload as Record<string, unknown>;
    const codeRaw = p.species_catalog_code;
    const code = typeof codeRaw === "string" && codeRaw.trim() ? codeRaw.trim() : null;
    const name = String(p.species_primary ?? "").trim() || "(unknown)";
    return { rank: c.rank, name, catalog_code: code };
  });
}

export function summarizeRecommendationResponse(params: {
  scenarioId: string;
  scenarioTitle: string;
  httpStatus: number;
  body: unknown;
}): ScenarioEvaluationRow {
  const base: ScenarioEvaluationRow = {
    scenario_id: params.scenarioId,
    scenario_title: params.scenarioTitle,
    http_status: params.httpStatus,
    ml_errors_preview: [],
    top_open_species: [],
    layout_attached: false,
    candidate_counts: { total: 0, open: 0, blocked: 0 },
    species_catalog_code_coverage_open: null,
    unresolved_open_count: 0,
    hard_constraint_summary: {
      open_with_hard_reasons: 0,
      blocked_with_hard_reasons: 0,
      pass: true,
    },
  };

  if (params.httpStatus !== 200 || params.body === null || typeof params.body !== "object") {
    base.error_message =
      params.httpStatus !== 200 ? `HTTP ${params.httpStatus}` : "non-object response body";
    return base;
  }

  const data = params.body as RecommendationGenerateResponse;
  const candidates = data.candidates ?? [];
  const open = candidates.filter((c) => !c.blocked);
  const blocked = candidates.filter((c) => c.blocked);
  base.mode = data.mode;
  base.generator_source = data.telemetryMeta?.generatorSource;
  base.rules_version = data.telemetryMeta?.rulesVersion;
  base.ml_errors_preview = (data.telemetryMeta?.mlErrors ?? []).map(String).slice(0, 8);
  base.candidate_counts = { total: candidates.length, open: open.length, blocked: blocked.length };
  base.top_open_species = topOpenSpecies(candidates, 8);
  base.hard_constraint_summary = hardSummaryForCandidates(candidates);

  if (open.length > 0) {
    const withCode = open.filter((c) => {
      const p = c.candidatePayload as Record<string, unknown>;
      const code = p.species_catalog_code;
      return typeof code === "string" && code.trim().length > 0;
    }).length;
    base.species_catalog_code_coverage_open = withCode / open.length;
    base.unresolved_open_count = open.length - withCode;
  }

  const slate = data.layoutSlate;
  if (slate) {
    base.layout_eligible = slate.eligible;
    base.layout_slate_status = slate.status;
    base.layout_attached = slate.eligible === true && slate.status === "attached";
    base.layout_failure_code = slate.failureCode ?? null;
  }

  return base;
}

export function evaluationReportToMarkdown(payload: EvaluationReportPayload): string {
  const lines: string[] = [
    `# Recommendation evaluation report`,
    ``,
    `- Generated: **${payload.generated_at}**`,
    `- Python stubbed (deterministic fallback): **${payload.python_stubbed ? "yes" : "no"}**`,
    ``,
    `| Scenario | gen.source | mode | layout | coverage | unresolved | HARD pass |`,
    `|----------|------------|------|--------|----------|------------|-----------|`,
  ];

  for (const r of payload.rows) {
    const cov =
      r.species_catalog_code_coverage_open != null
        ? `${(r.species_catalog_code_coverage_open * 100).toFixed(0)}%`
        : "—";
    const layout = r.layout_attached ? "attached" : r.layout_slate_status ?? "—";
    const hard = r.hard_constraint_summary.pass ? "ok" : "FAIL";
    lines.push(
      `| ${r.scenario_id} | ${r.generator_source ?? "—"} | ${r.mode ?? "—"} | ${layout} | ${cov} | ${r.unresolved_open_count} | ${hard} |`,
    );
  }

  lines.push(``, `## Detail`, ``);
  for (const r of payload.rows) {
    lines.push(`### ${r.scenario_id}: ${r.scenario_title}`, ``);
    if (r.error_message) {
      lines.push(`- **Error:** ${r.error_message}`, ``);
      continue;
    }
    lines.push(
      `- **Top open species:** ${r.top_open_species.map((s) => `${s.name}${s.catalog_code ? ` [${s.catalog_code}]` : " [unresolved]"}`).join("; ") || "—"}`,
      `- **Candidates:** total ${r.candidate_counts.total}, open ${r.candidate_counts.open}, blocked ${r.candidate_counts.blocked}`,
      `- **Hard constraints:** open_with_hard=${r.hard_constraint_summary.open_with_hard_reasons}, blocked_with_hard=${r.hard_constraint_summary.blocked_with_hard_reasons}`,
      `- **mlErrors (preview):** ${r.ml_errors_preview.join("; ") || "—"}`,
      ``,
    );
  }

  return lines.join("\n");
}

export function evaluationReportToCsv(payload: EvaluationReportPayload): string {
  const headers = [
    "scenario_id",
    "scenario_title",
    "http_status",
    "generator_source",
    "mode",
    "layout_slate_status",
    "layout_attached",
    "open_count",
    "blocked_count",
    "species_code_coverage_open",
    "unresolved_open_count",
    "hard_pass",
    "open_with_hard_reasons",
    "blocked_with_hard_reasons",
    "top_species_codes",
  ];
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [headers.join(",")];
  for (const r of payload.rows) {
    const codes = r.top_open_species.map((s) => s.catalog_code ?? "").join("|");
    rows.push(
      [
        esc(r.scenario_id),
        esc(r.scenario_title),
        String(r.http_status),
        esc(r.generator_source ?? ""),
        esc(r.mode ?? ""),
        esc(r.layout_slate_status ?? ""),
        r.layout_attached ? "1" : "0",
        String(r.candidate_counts.open),
        String(r.candidate_counts.blocked),
        r.species_catalog_code_coverage_open != null
          ? r.species_catalog_code_coverage_open.toFixed(4)
          : "",
        String(r.unresolved_open_count),
        r.hard_constraint_summary.pass ? "1" : "0",
        String(r.hard_constraint_summary.open_with_hard_reasons),
        String(r.hard_constraint_summary.blocked_with_hard_reasons),
        esc(codes),
      ].join(","),
    );
  }
  return rows.join("\n") + "\n";
}
