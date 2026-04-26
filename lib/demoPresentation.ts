/**
 * Compact, demo-safe views over recommendation + report payloads.
 * No LLM text; labels only. Safe when enrichment or fields are missing.
 */

import type { RecommendationGenerateResponse, RuntimeCandidate } from "@/lib/ml/recommendationRuntimeTypes";
import type { ReportPayloadView } from "@/lib/reportingTypes";

function str(x: unknown): string | null {
  if (x == null) return null;
  if (typeof x === "string") return x.trim() || null;
  if (typeof x === "number" && Number.isFinite(x)) return String(x);
  return null;
}

function formatInrRange(min?: number | null, max?: number | null, median?: number | null): string | null {
  const med = median != null && Number.isFinite(median) ? Math.round(median) : null;
  const lo = min != null && Number.isFinite(min) ? Math.round(min) : null;
  const hi = max != null && Number.isFinite(max) ? Math.round(max) : null;
  if (med != null && lo != null && hi != null) return `About ₹${med.toLocaleString("en-IN")} (range ₹${lo.toLocaleString("en-IN")}–₹${hi.toLocaleString("en-IN")})`;
  if (med != null) return `About ₹${med.toLocaleString("en-IN")}`;
  if (lo != null && hi != null) return `₹${lo.toLocaleString("en-IN")}–₹${hi.toLocaleString("en-IN")}`;
  return null;
}

function recommendationLabel(payload: Record<string, unknown>): string {
  const species = str(payload.species_primary) ?? str(payload.species);
  const density = str(payload.greenery_density);
  const cooling = str(payload.cooling_strategy) ?? str(payload.shade_solution);
  const parts = [species, density, cooling].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Green cooling layout";
}

function tempReductionHint(c: RuntimeCandidate): string | null {
  const p = c.candidatePayload;
  const direct =
    typeof p.expected_temp_reduction_c === "number"
      ? p.expected_temp_reduction_c
      : typeof p.expectedTempReductionC === "number"
        ? p.expectedTempReductionC
        : null;
  if (direct != null && Number.isFinite(direct)) return `Up to ~${direct.toFixed(1)}°C cooler (air)`;
  const bullets = c.explanation?.summaryBullets ?? [];
  const hit = bullets.find((b) => /°c|degree|cool|temp/i.test(b));
  return hit ?? null;
}

export type DemoCandidateCard = {
  rank: number;
  headline: string;
  recommendationType: string;
  tempReduction: string | null;
  installCost: string | null;
  maintenance: string | null;
  feasibilitySummary: string | null;
  highlights: string[];
  watchouts: string[];
};

export type DemoRecommendationPresentation = {
  title: string;
  generatorMode: string;
  enrichment: {
    geo: string;
    supply: string;
    pricing: string;
    note: string | null;
  };
  watchouts: string[];
  candidates: DemoCandidateCard[];
};

function humanizeEnrichment(s: string): string {
  if (s === "applied") return "Included";
  if (s === "skipped") return "Not run";
  if (s === "failed") return "Unavailable for this run";
  return s;
}

export function buildDemoRecommendationPresentation(
  res: RecommendationGenerateResponse,
): DemoRecommendationPresentation {
  const st = res.enrichmentStatus;
  const watchouts = (res.enrichmentWarnings ?? []).map((w) => {
    const phase =
      w.phase === "geo"
        ? "Location context"
        : w.phase === "supply"
          ? "Supply / season"
          : w.phase === "pricing"
            ? "Cost estimate"
            : w.phase === "shadow_eval"
              ? "Evaluation"
              : w.phase;
    return `${phase}: ${w.message}`;
  });

  const cards: DemoCandidateCard[] = [...res.candidates]
    .filter((c) => !c.blocked)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5)
    .map((c) => {
      const pr = c.pricing;
      const install = pr
        ? formatInrRange(pr.installCostRange.min, pr.installCostRange.max, pr.medianCostEstimate)
        : null;
      const maint = pr
        ? formatInrRange(
            pr.annualMaintenanceRange.min,
            pr.annualMaintenanceRange.max,
            pr.annualMaintenanceRange.median,
          )
        : null;
      const feas =
        str(c.explanation?.operational_risk_level) != null
          ? `Operational risk: ${c.explanation!.operational_risk_level}`
          : c.blockReasons?.length
            ? `Blocked: ${c.blockReasons.join("; ")}`
            : null;

      const adj: string[] = [];
      if (c.explanation?.cooling_opportunity_note) adj.push(String(c.explanation.cooling_opportunity_note));
      if (c.explanation?.irrigation_risk_note) adj.push(String(c.explanation.irrigation_risk_note));

      return {
        rank: c.rank,
        headline: recommendationLabel(c.candidatePayload),
        recommendationType: str(c.candidatePayload.recommendation_type) ?? "Cooling & greenery plan",
        tempReduction: tempReductionHint(c),
        installCost: install ?? "Estimate pending — pricing step skipped or failed",
        maintenance:
          maint ?? (pr ? "See install estimate" : "Estimate pending — pricing step skipped or failed"),
        feasibilitySummary: feas ?? (c.blocked ? "Not recommended as-is" : "Looks workable for the site"),
        highlights: (c.explanation?.summaryBullets ?? []).slice(0, 3),
        watchouts: [
          ...(c.explanation?.blocked_due_to_supply ?? []).map((x) => `Supply: ${x}`),
          ...(c.explanation?.blocked_due_to_season ?? []).map((x) => `Season: ${x}`),
          ...adj.slice(0, 2),
        ],
      };
    });

  let partialNote: string | null = null;
  if (res.enrichmentPartialSuccess) {
    partialNote = "Some optional enrichment steps did not complete; recommendations are still shown.";
  }
  if (res.enrichmentDegraded) {
    partialNote =
      (partialNote ? partialNote + " " : "") + "Results may be less precise until pricing or location data is available.";
  }

  return {
    title: "Ranked cooling recommendations",
    generatorMode:
      res.mode === "full_ml"
        ? "Rules + ML ranking"
        : res.mode === "partial_ml"
          ? "Rules + partial ML"
          : "Rules-based",
    enrichment: {
      geo: humanizeEnrichment(st?.geo ?? "skipped"),
      supply: humanizeEnrichment(st?.supply ?? "skipped"),
      pricing: humanizeEnrichment(st?.pricing ?? "skipped"),
      note: partialNote,
    },
    watchouts,
    candidates: cards.length ? cards : fallbackCardsFromAny(res.candidates),
  };
}

function fallbackCardsFromAny(candidates: RuntimeCandidate[]): DemoCandidateCard[] {
  return candidates.slice(0, 3).map((c) => ({
    rank: c.rank,
    headline: recommendationLabel(c.candidatePayload),
    recommendationType: str(c.candidatePayload.recommendation_type) ?? "Cooling & greenery plan",
    tempReduction: tempReductionHint(c),
    installCost: "—",
    maintenance: "—",
    feasibilitySummary: c.blocked ? "Blocked" : "See details in full response",
    highlights: (c.explanation?.summaryBullets ?? []).slice(0, 2),
    watchouts: [],
  }));
}

export type DemoUserReport = {
  projectSummary: string | null;
  recommendationOverview: string | null;
  coolingImpact: string | null;
  costSummary: string | null;
  maintenanceSummary: string | null;
  constraintsAndWatchouts: string[];
  confidenceAndProvenance: string | null;
  nextSteps: string[];
};

function sectionPayload(
  report: ReportPayloadView,
  key: string,
): Record<string, unknown> | null {
  const s = report.sections.find((x) => x.sectionKey === key);
  if (!s?.payload || typeof s.payload !== "object") return null;
  return s.payload as Record<string, unknown>;
}

function stringifySummary(obj: Record<string, unknown> | null, keys: string[]): string | null {
  if (!obj) return null;
  const parts: string[] = [];
  for (const k of keys) {
    const v = obj[k];
    const t = str(v) ?? (typeof v === "number" ? String(v) : null);
    if (t) parts.push(t);
  }
  return parts.length ? parts.join(" · ") : null;
}

function summarizeCoolingSection(cool: Record<string, unknown> | null): string | null {
  if (!cool) return null;
  const rows = cool.by_candidate;
  if (Array.isArray(rows) && rows.length) {
    const first = rows[0] as Record<string, unknown>;
    const t = first.expected_temp_reduction_c ?? first.expectedTempReductionC;
    if (typeof t === "number" && Number.isFinite(t)) {
      return `Top options target up to ~${Number(t).toFixed(1)}°C air-temperature reduction (model-assisted estimate).`;
    }
  }
  return "Cooling impact compares options in your dossier; see candidate breakdown for scores.";
}

export function buildDemoUserReport(report: ReportPayloadView): DemoUserReport {
  const proj = sectionPayload(report, "project_summary");
  const rec = sectionPayload(report, "recommendation_overview");
  const cool = sectionPayload(report, "cooling_impact_summary");
  const cost = sectionPayload(report, "cost_summary");
  const maint = sectionPayload(report, "maintenance_summary");
  const supply = sectionPayload(report, "supply_constraints_summary");
  const evidence = sectionPayload(report, "evidence_and_confidence");

  const constraints: string[] = [];
  if (supply) {
    const note = str(supply.note);
    const snap = supply.constraint_snapshot;
    if (note) constraints.push(note);
    if (snap && typeof snap === "object") {
      const o = snap as Record<string, unknown>;
      const r = str(o.region) ?? str(o.climate_zone);
      if (r) constraints.push(`Region: ${r}`);
    }
  }

  const nextSteps = [
    "Request a formal quote for your preferred option.",
    "Confirm drainage, water access, and rooftop load with your installer.",
    "Schedule a short site verification if anything in supply or season looks tight.",
  ];

  return {
    projectSummary: stringifySummary(proj, ["name", "location", "surface_type", "primary_goal", "area"]),
    recommendationOverview:
      stringifySummary(rec, ["total_candidates", "rules_version", "generator_source"])?.replace(/_/g, " ") ?? null,
    coolingImpact: summarizeCoolingSection(cool),
    costSummary: cost
      ? (() => {
          const n = cost.count;
          return typeof n === "number" && n > 0
            ? `Linked cost estimates: ${n}. See installer quote for binding numbers.`
            : "Cost estimates: see quote request.";
        })()
      : "Request a quote for firm pricing.",
    maintenanceSummary: maint
      ? "Annual maintenance ranges are estimated per option; your quote refines this."
      : "Maintenance expectations will follow from your selected design.",
    constraintsAndWatchouts: constraints,
    confidenceAndProvenance: evidence
      ? `Based on ${str(evidence.candidate_count) ?? "?"} options · rules ${str(evidence.rules_version) ?? "—"} · model ${str(evidence.model_version) ?? "—"}`
      : "Confidence details available in the evidence section.",
    nextSteps,
  };
}
