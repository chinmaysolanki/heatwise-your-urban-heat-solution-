import type { SpeciesAvailability } from "@prisma/client";

import type { RecommendationEvaluationContext } from "@/lib/ml/recommendationRuntimeTypes";
import type {
  ConstraintPreviewResponse,
  SupplyConstraintsPayloadV1,
  SupplyReadinessV1,
} from "@/lib/ml/supplyConstraintTypes";
import type { RuntimeCandidate } from "@/lib/ml/recommendationRuntimeTypes";
import { db } from "@/lib/db";
import { installerCoverageSignal, aggregateReadinessRows, listRegionalReadiness } from "@/lib/services/regionalReadinessService";
import { listSeasonalWindows, monthInWindow } from "@/lib/services/seasonalConstraintService";
import { listMaterialInventory, listSpeciesAvailability } from "@/lib/services/supplyAvailabilityService";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function parseSubstitutes(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (Array.isArray(v)) return v.map((x) => String(x));
    if (v && typeof v === "object" && "species" in v && Array.isArray((v as { species: unknown }).species)) {
      return (v as { species: string[] }).species.map(String);
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function resolveSupplyRegion(
  project: Record<string, unknown>,
  environment: Record<string, unknown>,
  ctx?: RecommendationEvaluationContext | null,
): string | null {
  const direct =
    project.region ?? environment.region ?? (ctx as { region?: string | null } | null)?.region;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const loc = project.location;
  if (typeof loc === "string" && loc.includes(",")) {
    const tail = loc.split(",").pop()?.trim();
    if (tail) return tail;
  }
  if (typeof loc === "string" && loc.trim()) return loc.trim();
  const env = process.env.HEATWISE_DEFAULT_REGION?.trim();
  return env || null;
}

export function resolveClimateZone(
  environment: Record<string, unknown>,
  ctx?: RecommendationEvaluationContext | null,
): string {
  const z = environment.climate_zone ?? environment.climateZone ?? ctx?.climateZone;
  if (typeof z === "string" && z.trim()) return z.trim();
  return "temperate_mixed";
}

export function resolveProjectType(project: Record<string, unknown>): string {
  const p = project.project_type ?? project.space_kind ?? "rooftop";
  return String(p || "rooftop");
}

/**
 * Apply the same supply v1 rules as Python (subset) to TS fallback candidates.
 */
export function applySupplyConstraintsToRuntimeCandidates(
  candidates: RuntimeCandidate[],
  supply: SupplyConstraintsPayloadV1 | undefined,
): void {
  if (!supply || supply.version !== 1) return;

  const blockedSpecies = new Set(supply.blockedSpecies.map(norm));
  const seasonalBlocked = new Set(supply.seasonallyBlockedSpecies.map(norm));
  const blockedMaterials = new Set(supply.blockedMaterials.map(norm));
  const blockedSolutions = new Set(supply.blockedSolutionTypes.map(norm));
  const substitutions = Object.fromEntries(
    Object.entries(supply.substitutions).map(([k, v]) => [norm(k), v.trim()]),
  );

  for (const row of candidates) {
    const cand = { ...(row.candidatePayload as Record<string, unknown>) };
    const expl = { ...(row.explanation as Record<string, unknown>) };
    const ruleBlocked = row.blocked;

    let substituted: { from: string; to: string } | null = null;
    let sp = norm(String(cand.species_primary ?? ""));
    if (sp && substitutions[sp]) {
      const toName = substitutions[sp];
      substituted = { from: String(cand.species_primary), to: toName };
      cand.species_primary = toName;
      cand.species_secondary = toName;
      cand.species_tertiary = toName;
      sp = norm(toName);
    }

    const blockedSupply: string[] = [];
    const blockedSeason: string[] = [];
    if (sp && blockedSpecies.has(sp)) blockedSupply.push(`species_unavailable:${sp}`);
    if (sp && seasonalBlocked.has(sp)) blockedSeason.push(`season_unsuitable:${sp}`);
    const shade = norm(String(cand.shade_solution ?? ""));
    if (shade && shade !== "none" && blockedSolutions.has(shade)) blockedSupply.push(`solution_blocked:${shade}`);
    const planter = norm(String(cand.planter_type ?? ""));
    if (planter && blockedMaterials.has(planter)) blockedSupply.push(`material_low_stock:${planter}`);

    if (!ruleBlocked && (blockedSupply.length || blockedSeason.length)) {
      row.blocked = true;
      row.blockReasons = [...(row.blockReasons ?? []), ...blockedSupply, ...blockedSeason];
      row.scores = { ...row.scores, blended: 0 };
      expl.blocked = true;
    } else if (!ruleBlocked && !row.blocked) {
      let blended = Number(row.scores.blended ?? 0);
      let soft = supply.globalSoftMultiplier;
      const spPen = supply.speciesSoftPenalties[sp];
      if (spPen) soft *= spPen.multiplier;
      const solPen = supply.solutionSoftPenalties[shade];
      if (solPen) soft *= solPen.multiplier;
      const irr = norm(String(cand.irrigation_type ?? ""));
      if (["drip", "sprinkler", "automatic"].includes(irr)) soft *= supply.irrigationSoftMultiplier;
      if (["pergola", "green_wall_segment", "shade_sail"].includes(shade)) soft *= supply.structuralSoftMultiplier;
      blended *= Math.max(0.05, Math.min(1, soft));
      row.scores = { ...row.scores, blended: Math.round(blended * 1e6) / 1e6 };
      expl.finalBlendedScore = row.scores.blended;
    }

    expl.substituted_species = substituted;
    expl.blocked_due_to_supply = blockedSupply;
    expl.blocked_due_to_season = blockedSeason;
    expl.operational_risk_level = supply.readiness.operationalRiskLevel;
    expl.lead_time_note = supply.leadTimeNote;
    expl.regional_readiness_note = supply.regionalReadinessNote;
    expl.recommended_now_vs_later = supply.deferInstallSuggested ? "later" : "now";
    expl.confidence_adjustment_reason = supply.confidenceAdjustmentReason;
    row.candidatePayload = cand;
    row.explanation = expl as RuntimeCandidate["explanation"];
  }

  candidates.sort((a, b) => Number(b.scores.blended) - Number(a.scores.blended));
  candidates.forEach((c, i) => {
    c.rank = i + 1;
  });
}

function readinessLevel(overall: number, seasonal: number): SupplyReadinessV1["operationalRiskLevel"] {
  const m = Math.min(overall, seasonal);
  if (m >= 0.55) return "low";
  if (m >= 0.35) return "medium";
  return "high";
}

export async function buildSupplyConstraintsPayload(input: {
  project: Record<string, unknown>;
  environment: Record<string, unknown>;
  preferences: Record<string, unknown>;
  evaluationContext?: RecommendationEvaluationContext | null;
  monthOfYear?: number;
}): Promise<SupplyConstraintsPayloadV1 | null> {
  const region = resolveSupplyRegion(input.project, input.environment, input.evaluationContext ?? null);
  if (!region) return null;

  const climateZone = resolveClimateZone(input.environment, input.evaluationContext ?? null);
  const projectType = resolveProjectType(input.project);
  const month =
    input.monthOfYear ??
    (typeof input.preferences.month_of_year === "number" ? input.preferences.month_of_year : new Date().getMonth() + 1);

  const [speciesRows, materialRows, windows, readinessRows, installerCov] = await Promise.all([
    listSpeciesAvailability({ region }),
    listMaterialInventory({ region }),
    listSeasonalWindows({ region, climateZone, projectType }),
    listRegionalReadiness(region, projectType),
    installerCoverageSignal(region),
  ]);

  const blockedSpecies: string[] = [];
  const substitutions: Record<string, string> = {};
  const speciesSoftPenalties: SupplyConstraintsPayloadV1["speciesSoftPenalties"] = {};

  for (const s of speciesRows) {
    const sn = norm(s.speciesName);
    const st = s.availabilityStatus;
    const subs = parseSubstitutes(s.substituteSpeciesJson);
    if (st === "unavailable") {
      if (subs[0]) substitutions[sn] = subs[0];
      else blockedSpecies.push(sn);
    } else if (st === "backorder" || st === "limited") {
      const mult = st === "backorder" ? 0.82 : 0.9;
      speciesSoftPenalties[sn] = {
        multiplier: mult * (s.availabilityConfidence || 1),
        reason: `Supply status: ${st}`,
      };
    }
    const lt = s.estimatedLeadTimeDays;
    if (lt != null && lt > 21) {
      const prev = speciesSoftPenalties[sn]?.multiplier ?? 1;
      speciesSoftPenalties[sn] = {
        multiplier: Math.min(prev, 0.88),
        reason: `Lead time ~${lt}d`,
      };
    }
  }

  const blockedMaterials: string[] = [];
  for (const m of materialRows) {
    const token = norm(m.materialName);
    const token2 = norm(m.materialType);
    if (m.stockBand === "out" || m.availabilityStatus === "unavailable") {
      if (token) blockedMaterials.push(token);
      if (token2 && token2 !== token) blockedMaterials.push(token2);
    }
  }

  const seasonallyBlockedSpecies: string[] = [];
  const blockedSolutionTypes: string[] = [];
  let seasonalReadinessScore = 0.75;

  for (const w of windows) {
    if (!monthInWindow(month, w.startMonth, w.endMonth)) continue;
    const level = w.suitabilityLevel;
    if (level === "optimal" || level === "acceptable") seasonalReadinessScore = Math.max(seasonalReadinessScore, 0.85);
    if (level === "marginal") seasonalReadinessScore = Math.min(seasonalReadinessScore, 0.62);
    if (level === "unsuitable") {
      seasonalReadinessScore = Math.min(seasonalReadinessScore, 0.35);
      if (w.speciesName) seasonallyBlockedSpecies.push(norm(w.speciesName));
      if (w.solutionType && !w.speciesName) blockedSolutionTypes.push(norm(w.solutionType));
    }
  }

  const agg = aggregateReadinessRows(readinessRows);
  let supplyReadinessScore = agg?.overallSupplyReadinessScore ?? installerCov * 0.85 + 0.15 * 0.5;
  if (!readinessRows.length) {
    supplyReadinessScore = Math.min(1, installerCov * 0.9 + (speciesRows.length ? 0.08 : 0));
  }

  const solutionSoftPenalties: SupplyConstraintsPayloadV1["solutionSoftPenalties"] = {};
  const irrScore = agg?.irrigationReadinessScore ?? 0.55;
  const structScore = agg?.structuralExecutionReadinessScore ?? 0.55;
  const irrigationSoftMultiplier = irrScore < 0.45 ? 0.88 : irrScore < 0.55 ? 0.94 : 1;
  const structuralSoftMultiplier = structScore < 0.4 ? 0.85 : structScore < 0.55 ? 0.92 : 1;
  if (irrigationSoftMultiplier < 1) {
    solutionSoftPenalties.drip = { multiplier: irrigationSoftMultiplier, reason: "Irrigation execution readiness in region" };
  }
  if (structuralSoftMultiplier < 1) {
    solutionSoftPenalties.pergola = {
      multiplier: structuralSoftMultiplier,
      reason: "Structural / shade execution readiness in region",
    };
    solutionSoftPenalties.shade_sail = {
      multiplier: Math.min(structuralSoftMultiplier + 0.04, 1),
      reason: "Structural / shade execution readiness in region",
    };
  }

  const readiness: SupplyReadinessV1 = {
    supplyReadinessScore,
    seasonalReadinessScore,
    operationalRiskLevel: readinessLevel(supplyReadinessScore, seasonalReadinessScore),
  };

  const deferInstallSuggested = supplyReadinessScore < 0.3 || seasonalReadinessScore < 0.32;
  const globalSoftMultiplier =
    readiness.operationalRiskLevel === "high" ? 0.9 : readiness.operationalRiskLevel === "medium" ? 0.96 : 1;

  const explanationNotes: string[] = [];
  if (deferInstallSuggested) explanationNotes.push("Defer install: supply or seasonal readiness is weak for this window.");
  if (readiness.operationalRiskLevel !== "low") {
    explanationNotes.push("Operational risk elevated — confirm installer and material availability before committing.");
  }

  const leadTimeNote =
    speciesRows.some((s: SpeciesAvailability) => (s.estimatedLeadTimeDays ?? 0) > 21)
      ? "Some species/materials show extended lead times."
      : null;
  const regionalReadinessNote = `Region ${region}: supply readiness ${(supplyReadinessScore * 100).toFixed(0)}%, seasonal ${(seasonalReadinessScore * 100).toFixed(0)}%.`;
  const confidenceAdjustmentReason =
    readiness.operationalRiskLevel === "low" ? null : "Scores downweighted for regional supply / seasonal readiness.";

  const payload: SupplyConstraintsPayloadV1 = {
    version: 1,
    context: { region, climateZone, monthOfYear: month, projectType },
    blockedSpecies,
    seasonallyBlockedSpecies,
    blockedMaterials,
    blockedSolutionTypes,
    substitutions,
    speciesSoftPenalties,
    solutionSoftPenalties,
    globalSoftMultiplier,
    irrigationSoftMultiplier,
    structuralSoftMultiplier,
    readiness,
    deferInstallSuggested,
    leadTimeNote,
    regionalReadinessNote,
    confidenceAdjustmentReason,
    explanationNotes,
  };

  return payload;
}

export async function buildConstraintPreview(input: {
  project: Record<string, unknown>;
  environment: Record<string, unknown>;
  preferences: Record<string, unknown>;
  evaluationContext?: RecommendationEvaluationContext | null;
  monthOfYear?: number;
}): Promise<ConstraintPreviewResponse> {
  const supplyConstraints = (await buildSupplyConstraintsPayload(input)) ?? emptyPayload(input);
  const hardBlocks: ConstraintPreviewResponse["hardBlocks"] = [];
  for (const s of supplyConstraints.blockedSpecies) {
    hardBlocks.push({ kind: "species", value: s, reason: "Unavailable in region (no substitute configured)" });
  }
  for (const s of supplyConstraints.seasonallyBlockedSpecies) {
    hardBlocks.push({ kind: "season", value: s, reason: "Seasonal window marked unsuitable" });
  }
  for (const m of supplyConstraints.blockedMaterials) {
    hardBlocks.push({ kind: "material", value: m, reason: "Out of stock / unavailable" });
  }
  for (const sol of supplyConstraints.blockedSolutionTypes) {
    hardBlocks.push({ kind: "solution_type", value: sol, reason: "Seasonal / regional block on solution type" });
  }
  const softPenalties: ConstraintPreviewResponse["softPenalties"] = [];
  for (const [target, p] of Object.entries(supplyConstraints.speciesSoftPenalties)) {
    softPenalties.push({ target: `species:${target}`, multiplier: p.multiplier, reason: p.reason });
  }
  for (const [target, p] of Object.entries(supplyConstraints.solutionSoftPenalties)) {
    softPenalties.push({ target: `solution:${target}`, multiplier: p.multiplier, reason: p.reason });
  }
  if (supplyConstraints.globalSoftMultiplier < 1) {
    softPenalties.push({
      target: "global",
      multiplier: supplyConstraints.globalSoftMultiplier,
      reason: "Operational readiness composite",
    });
  }
  const suggestedSubstitutions: ConstraintPreviewResponse["suggestedSubstitutions"] = [];
  for (const [from, to] of Object.entries(supplyConstraints.substitutions)) {
    suggestedSubstitutions.push({ from, to, reason: "Mapped substitute for unavailable primary species" });
  }
  return {
    hardBlocks,
    softPenalties,
    suggestedSubstitutions,
    readiness: supplyConstraints.readiness,
    supplyConstraints,
    notes: [...supplyConstraints.explanationNotes, supplyConstraints.regionalReadinessNote].filter(Boolean) as string[],
  };
}

function emptyPayload(input: {
  project: Record<string, unknown>;
  environment: Record<string, unknown>;
  preferences: Record<string, unknown>;
  evaluationContext?: RecommendationEvaluationContext | null;
  monthOfYear?: number;
}): SupplyConstraintsPayloadV1 {
  const region = resolveSupplyRegion(input.project, input.environment, input.evaluationContext ?? null) ?? "unknown";
  const climateZone = resolveClimateZone(input.environment, input.evaluationContext ?? null);
  const projectType = resolveProjectType(input.project);
  const month =
    input.monthOfYear ??
    (typeof input.preferences.month_of_year === "number" ? input.preferences.month_of_year : new Date().getMonth() + 1);
  return {
    version: 1,
    context: { region, climateZone, monthOfYear: month, projectType },
    blockedSpecies: [],
    seasonallyBlockedSpecies: [],
    blockedMaterials: [],
    blockedSolutionTypes: [],
    substitutions: {},
    speciesSoftPenalties: {},
    solutionSoftPenalties: {},
    globalSoftMultiplier: 1,
    irrigationSoftMultiplier: 1,
    structuralSoftMultiplier: 1,
    readiness: { supplyReadinessScore: 0.55, seasonalReadinessScore: 0.55, operationalRiskLevel: "medium" },
    deferInstallSuggested: false,
    leadTimeNote: null,
    regionalReadinessNote: "No supply rows resolved; using neutral defaults.",
    confidenceAdjustmentReason: null,
    explanationNotes: [],
  };
}

export async function persistConstraintSnapshot(input: {
  projectId?: string | null;
  recommendationSessionId?: string | null;
  supply: SupplyConstraintsPayloadV1;
}): Promise<string> {
  const { supply } = input;
  const snap = await db.recommendationConstraintSnapshot.create({
    data: {
      projectId: input.projectId ?? undefined,
      recommendationSessionId: input.recommendationSessionId ?? undefined,
      region: supply.context.region,
      climateZone: supply.context.climateZone,
      monthOfYear: supply.context.monthOfYear,
      constraintFlagsJson: JSON.stringify({
        deferInstallSuggested: supply.deferInstallSuggested,
        version: supply.version,
      }),
      blockedSpeciesJson: JSON.stringify(supply.blockedSpecies),
      blockedMaterialsJson: JSON.stringify(supply.blockedMaterials),
      blockedSolutionTypesJson: JSON.stringify(supply.blockedSolutionTypes),
      allowedSubstitutionsJson: JSON.stringify(supply.substitutions),
      supplyReadinessScore: supply.readiness.supplyReadinessScore,
      seasonalReadinessScore: supply.readiness.seasonalReadinessScore,
    },
  });
  return snap.id;
}
