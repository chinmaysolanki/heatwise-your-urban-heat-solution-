/**
 * Minimal rules-only slate when the Python runtime is unavailable.
 * Species and templates are context-aware (sun, heat, water, pet-safety, goal).
 * Keep aligned in spirit with ``ml/serving/orchestration/candidate_generator.py``.
 */

import type { RecommendationGenerateRequest, RecommendationGenerateResponse, RuntimeCandidate } from "@/lib/ml/recommendationRuntimeTypes";
import { applySupplyConstraintsToRuntimeCandidates } from "@/lib/services/recommendationConstraintService";

const RULES_VERSION = "hw-rules-v2.0-ts-fallback";

// ── Context helpers ───────────────────────────────────────────────────────────

function normStr(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function heatLevel(env: Record<string, unknown>): "low" | "medium" | "high" | "extreme" {
  const explicit = normStr(env.heat_exposure ?? env.heatExposure);
  if (explicit === "extreme" || explicit === "high" || explicit === "medium" || explicit === "low") {
    return explicit as "low" | "medium" | "high" | "extreme";
  }
  const maxT = Number(env.daily_max_temp_c ?? env.summerTempC ?? env.summer_temp_c ?? NaN);
  if (!Number.isFinite(maxT)) return "medium";
  if (maxT >= 38) return "extreme";
  if (maxT >= 33) return "high";
  if (maxT >= 28) return "medium";
  return "low";
}

function sunBucket(env: Record<string, unknown>): "full" | "part" | "shade" {
  const s = normStr(env.sunExposure ?? env.sun_exposure ?? env.shade_level ?? "");
  if (s.includes("full") || s.includes("high") || s === "none") return "full";
  if (s.includes("shade") || s.includes("heavy") || s.includes("low")) return "shade";
  return "part";
}

function waterScarce(env: Record<string, unknown>): boolean {
  return normStr(env.water_availability ?? env.waterAvailability) === "scarce";
}

function isPetSafeRequired(prefs: Record<string, unknown>): boolean {
  return Number(prefs.child_pet_safe_required ?? prefs.petSafeRequired ?? 0) > 0;
}

function isIndoor(project: Record<string, unknown>): boolean {
  return normStr(project.space_type ?? project.spaceType ?? "").includes("indoor");
}

function isFood(prefs: Record<string, unknown>): boolean {
  const p = normStr(prefs.purpose_primary ?? "");
  return p.includes("food") || p.includes("edible") || p.includes("herb") || p.includes("kitchen");
}

function maintenancePref(prefs: Record<string, unknown>): "low" | "medium" | "high" {
  const m = normStr(prefs.maintenanceLevel ?? prefs.maintenance_level ?? "medium");
  if (m.includes("low") || m.includes("minimal")) return "low";
  if (m.includes("high")) return "high";
  return "medium";
}

// ── Species catalogue (no DB needed) ─────────────────────────────────────────
//
// Each entry: [displayName, coolingScore 1-5, petSafe, droughtTolerant, shade OK, edible]
//
type SpeciesEntry = {
  name: string;
  cooling: number;      // 1–5
  petSafe: boolean;
  drought: boolean;
  shadeOk: boolean;     // survives part/shade
  edible: boolean;
  lowMaint: boolean;
  tempReductionC: number;
};

const SPECIES: SpeciesEntry[] = [
  // Drought + heat heroes (rooftop / extreme heat)
  { name: "Snake Plant (Sansevieria)",    cooling: 3, petSafe: false, drought: true,  shadeOk: true,  edible: false, lowMaint: true,  tempReductionC: 1.4 },
  { name: "Aloe Vera",                    cooling: 3, petSafe: false, drought: true,  shadeOk: false, edible: false, lowMaint: true,  tempReductionC: 1.3 },
  { name: "Jade Plant",                   cooling: 2, petSafe: false, drought: true,  shadeOk: false, edible: false, lowMaint: true,  tempReductionC: 1.0 },
  { name: "Portulaca (Moss Rose)",        cooling: 2, petSafe: true,  drought: true,  shadeOk: false, edible: false, lowMaint: true,  tempReductionC: 1.0 },
  { name: "Sedum (Stonecrop)",            cooling: 2, petSafe: true,  drought: true,  shadeOk: false, edible: false, lowMaint: true,  tempReductionC: 1.0 },
  // High cooling, full/part sun
  { name: "Areca Palm",                   cooling: 5, petSafe: true,  drought: false, shadeOk: true,  edible: false, lowMaint: false, tempReductionC: 2.8 },
  { name: "Bamboo (Clumping)",            cooling: 5, petSafe: true,  drought: false, shadeOk: true,  edible: false, lowMaint: false, tempReductionC: 3.2 },
  { name: "Vetiver Grass",                cooling: 4, petSafe: true,  drought: true,  shadeOk: false, edible: false, lowMaint: true,  tempReductionC: 2.2 },
  { name: "Moringa",                      cooling: 4, petSafe: true,  drought: true,  shadeOk: false, edible: true,  lowMaint: true,  tempReductionC: 2.0 },
  // Indoor / shade
  { name: "Pothos (Money Plant)",         cooling: 2, petSafe: false, drought: false, shadeOk: true,  edible: false, lowMaint: true,  tempReductionC: 1.0 },
  { name: "Peace Lily",                   cooling: 3, petSafe: false, drought: false, shadeOk: true,  edible: false, lowMaint: true,  tempReductionC: 1.3 },
  { name: "Spider Plant",                 cooling: 2, petSafe: true,  drought: false, shadeOk: true,  edible: false, lowMaint: true,  tempReductionC: 0.9 },
  { name: "ZZ Plant",                     cooling: 2, petSafe: false, drought: true,  shadeOk: true,  edible: false, lowMaint: true,  tempReductionC: 0.8 },
  { name: "Boston Fern",                  cooling: 3, petSafe: true,  drought: false, shadeOk: true,  edible: false, lowMaint: false, tempReductionC: 1.5 },
  // Pet-safe + medium light
  { name: "Marigold",                     cooling: 2, petSafe: true,  drought: false, shadeOk: false, edible: false, lowMaint: true,  tempReductionC: 0.9 },
  { name: "Zinnia",                       cooling: 2, petSafe: true,  drought: true,  shadeOk: false, edible: false, lowMaint: true,  tempReductionC: 0.9 },
  { name: "Sunflower",                    cooling: 3, petSafe: true,  drought: true,  shadeOk: false, edible: true,  lowMaint: true,  tempReductionC: 1.4 },
  // Edible / food garden
  { name: "Curry Leaf Tree",              cooling: 3, petSafe: true,  drought: true,  shadeOk: false, edible: true,  lowMaint: true,  tempReductionC: 1.6 },
  { name: "Drumstick (Moringa)",          cooling: 4, petSafe: true,  drought: true,  shadeOk: false, edible: true,  lowMaint: true,  tempReductionC: 2.0 },
  { name: "Mint",                         cooling: 2, petSafe: true,  drought: false, shadeOk: true,  edible: true,  lowMaint: true,  tempReductionC: 0.8 },
  { name: "Tulsi (Holy Basil)",           cooling: 2, petSafe: true,  drought: true,  shadeOk: false, edible: true,  lowMaint: true,  tempReductionC: 0.9 },
  { name: "Lemon Grass",                  cooling: 3, petSafe: true,  drought: true,  shadeOk: false, edible: true,  lowMaint: true,  tempReductionC: 1.5 },
];

function selectSpecies(
  petSafe: boolean,
  scarce: boolean,
  heat: "low" | "medium" | "high" | "extreme",
  sun: "full" | "part" | "shade",
  food: boolean,
  indoor: boolean,
): SpeciesEntry[] {
  let pool = SPECIES.filter((s) => {
    if (petSafe && !s.petSafe) return false;
    if (scarce && !s.drought) return false;
    if (indoor && !s.shadeOk) return false;
    if (!indoor && sun === "shade" && !s.shadeOk) return false;
    return true;
  });

  // Score each to rank
  const scored = pool.map((s) => {
    let score = s.cooling;
    if (food && s.edible) score += 2;
    if (!food && s.cooling >= 4) score += 1;
    if ((heat === "extreme" || heat === "high") && s.drought) score += 1;
    if (sun === "shade" && s.shadeOk) score += 0.5;
    if (s.lowMaint) score += 0.3;
    return { s, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Return top 3 distinct
  const out: SpeciesEntry[] = [];
  for (const { s } of scored) {
    if (!out.find((x) => x.name === s.name)) out.push(s);
    if (out.length >= 3) break;
  }

  // Ensure at least 1 fallback
  if (out.length === 0) out.push(SPECIES.find((s) => s.petSafe && s.lowMaint)!);
  return out;
}

// ── Template definitions ──────────────────────────────────────────────────────

type TemplateDef = {
  id: string;
  recommendation_type: string;
  greenery_density: string;
  planter_type: string;
  irrigation_type: string;
  shade_solution: string;
  cooling_strategy: string;
  maintenance_level_pred: string;
  species_mix_type: string;
  species_count_estimate: number;
  base_install_cost_inr: number;
  annual_maintenance_inr: number;
  base_temp_reduction_c: number;
  base_surface_reduction_c: number;
  rule_template_score: number;
};

const TEMPLATES: TemplateDef[] = [
  {
    id: "raised_planter_drip",
    recommendation_type: "planter",
    greenery_density: "medium",
    planter_type: "raised",
    irrigation_type: "drip",
    shade_solution: "pergola",
    cooling_strategy: "evapotranspiration",
    maintenance_level_pred: "low",
    species_mix_type: "duo",
    species_count_estimate: 2,
    base_install_cost_inr: 42_000,
    annual_maintenance_inr: 5800,
    base_temp_reduction_c: 1.8,
    base_surface_reduction_c: 3.6,
    rule_template_score: 0.74,
  },
  {
    id: "shade_sail_container",
    recommendation_type: "shade_first",
    greenery_density: "low",
    planter_type: "container",
    irrigation_type: "manual",
    shade_solution: "shade_sail",
    cooling_strategy: "shading",
    maintenance_level_pred: "minimal",
    species_mix_type: "mono",
    species_count_estimate: 1,
    base_install_cost_inr: 28_000,
    annual_maintenance_inr: 3800,
    base_temp_reduction_c: 1.2,
    base_surface_reduction_c: 3.0,
    rule_template_score: 0.66,
  },
  {
    id: "green_wall_high",
    recommendation_type: "planter",
    greenery_density: "high",
    planter_type: "raised",
    irrigation_type: "drip",
    shade_solution: "green_wall_segment",
    cooling_strategy: "evapotranspiration",
    maintenance_level_pred: "medium",
    species_mix_type: "polyculture_lite",
    species_count_estimate: 4,
    base_install_cost_inr: 62_000,
    annual_maintenance_inr: 8500,
    base_temp_reduction_c: 2.4,
    base_surface_reduction_c: 4.8,
    rule_template_score: 0.78,
  },
  {
    id: "food_garden_raised",
    recommendation_type: "planter",
    greenery_density: "medium",
    planter_type: "raised",
    irrigation_type: "drip",
    shade_solution: "pergola",
    cooling_strategy: "evapotranspiration",
    maintenance_level_pred: "medium",
    species_mix_type: "polyculture_lite",
    species_count_estimate: 3,
    base_install_cost_inr: 38_000,
    annual_maintenance_inr: 6200,
    base_temp_reduction_c: 1.6,
    base_surface_reduction_c: 3.2,
    rule_template_score: 0.72,
  },
  {
    id: "indoor_container",
    recommendation_type: "planter",
    greenery_density: "low",
    planter_type: "container",
    irrigation_type: "manual",
    shade_solution: "none",
    cooling_strategy: "evapotranspiration",
    maintenance_level_pred: "low",
    species_mix_type: "mono",
    species_count_estimate: 2,
    base_install_cost_inr: 18_000,
    annual_maintenance_inr: 2400,
    base_temp_reduction_c: 0.8,
    base_surface_reduction_c: 1.6,
    rule_template_score: 0.62,
  },
];

function pickTemplates(
  food: boolean,
  indoor: boolean,
  heat: "low" | "medium" | "high" | "extreme",
  scarce: boolean,
  budget: number,
  maint: "low" | "medium" | "high",
): TemplateDef[] {
  if (indoor) return [TEMPLATES[4]!, TEMPLATES[1]!];
  if (food) return [TEMPLATES[3]!, TEMPLATES[0]!];
  if (heat === "extreme" || heat === "high") return [TEMPLATES[0]!, TEMPLATES[2]!, TEMPLATES[1]!];
  if (scarce) return [TEMPLATES[1]!, TEMPLATES[0]!];
  if (budget < 30_000) return [TEMPLATES[1]!, TEMPLATES[0]!];
  return [TEMPLATES[0]!, TEMPLATES[2]!, TEMPLATES[1]!];
}

// ── Hard block ────────────────────────────────────────────────────────────────

function hardBlock(
  project: Record<string, unknown>,
  preferences: Record<string, unknown>,
  cost: number,
): string[] {
  const reasons: string[] = [];
  const budget = Number(project.budget_inr ?? preferences.budget_inr ?? 0);
  if (budget > 0 && cost > budget * 1.25) reasons.push("HARD_BUDGET_EXCEEDED");
  return reasons;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildRulesOnlyFallback(req: RecommendationGenerateRequest): RecommendationGenerateResponse {
  const project = (req.project ?? {}) as Record<string, unknown>;
  const environment = (req.environment ?? {}) as Record<string, unknown>;
  const preferences = (req.preferences ?? {}) as Record<string, unknown>;
  const budget = Number(project.budget_inr ?? preferences.budget_inr ?? 80_000);
  const maxC = Math.max(1, Math.min(8, Number(req.maxCandidates ?? 8)));

  // Derive context
  const heat = heatLevel(environment);
  const sun = sunBucket(environment);
  const scarce = waterScarce(environment);
  const petSafe = isPetSafeRequired(preferences);
  const food = isFood(preferences);
  const indoor = isIndoor(project);
  const maint = maintenancePref(preferences);

  const speciesPool = selectSpecies(petSafe, scarce, heat, sun, food, indoor);
  const templates = pickTemplates(food, indoor, heat, scarce, budget, maint);

  const candidates: RuntimeCandidate[] = [];
  let rank = 1;

  for (let i = 0; i < templates.length && candidates.length < maxC; i++) {
    const tmpl = templates[i]!;
    const primary = speciesPool[0]!;
    const secondary = speciesPool[1] ?? primary;
    const tertiary = speciesPool[2] ?? secondary;

    // Scale cost to budget, add cooling boost from primary species
    const coolingBoost = Math.min(0.9, primary.tempReductionC * 0.18);
    const installCost = Math.min(tmpl.base_install_cost_inr * (1 + (i > 0 ? 0.05 : 0)), budget * 1.15);
    const tempReduction = +(tmpl.base_temp_reduction_c + coolingBoost).toFixed(1);
    const surfReduction = +(tmpl.base_surface_reduction_c + coolingBoost * 1.5).toFixed(1);

    const blockReasons = hardBlock(project, preferences, installCost);
    const blocked = blockReasons.length > 0;
    const baseScore = tmpl.rule_template_score - i * 0.04;

    const payload: Record<string, unknown> = {
      candidate_id: `cand_ts_${Math.random().toString(36).slice(2, 10)}`,
      recommendation_type: tmpl.recommendation_type,
      greenery_density: tmpl.greenery_density,
      planter_type: tmpl.planter_type,
      irrigation_type: tmpl.irrigation_type,
      shade_solution: tmpl.shade_solution,
      cooling_strategy: tmpl.cooling_strategy,
      maintenance_level_pred: tmpl.maintenance_level_pred,
      species_mix_type: tmpl.species_mix_type,
      species_count_estimate: tmpl.species_count_estimate,
      estimated_install_cost_inr: Math.round(installCost),
      estimated_annual_maintenance_inr: tmpl.annual_maintenance_inr,
      expected_temp_reduction_c: tempReduction,
      expected_surface_temp_reduction_c: surfReduction,
      species_primary: primary.name,
      species_secondary: secondary.name,
      species_tertiary: tertiary.name,
      rule_template_score: baseScore,
      context_heat_level: heat,
      context_sun_bucket: sun,
      context_water_scarce: scarce,
    };

    const bullets = blocked
      ? [`Blocked: ${blockReasons.join(", ")}`]
      : [
          `${primary.name} selected for ${heat} heat, ${sun} sun conditions.`,
          `Estimated ${tempReduction}°C air temp reduction · ${surfReduction}°C surface reduction.`,
          food ? `Includes edible companion: ${secondary.name}.` : `Companion planting with ${secondary.name}.`,
        ];

    candidates.push({
      candidateId: String(payload.candidate_id),
      rank: rank++,
      blocked,
      blockReasons,
      scores: {
        rulePrior: baseScore,
        feasibilityMl: null,
        heatMl: null,
        rankingMl: null,
        blended: blocked ? 0 : baseScore,
        blendParts: { rules: baseScore },
      },
      candidatePayload: payload,
      explanation: {
        summaryBullets: bullets,
        componentScores: { rules: baseScore },
        finalBlendedScore: blocked ? 0 : baseScore,
        mlHeadsUsed: { feasibility: false, heat: false, ranking: false },
        blocked,
      },
    });
  }

  candidates.sort((a, b) => Number(b.scores.blended) - Number(a.scores.blended));
  candidates.forEach((c, i) => { c.rank = i + 1; });

  if (req.supplyConstraints) {
    applySupplyConstraintsToRuntimeCandidates(candidates, req.supplyConstraints);
  }

  return {
    mode: "rules_only",
    candidates,
    telemetryMeta: {
      generatorSource: "live_rules",
      rulesVersion: req.rulesVersion ?? RULES_VERSION,
      modelVersionFeasibility: null,
      modelVersionHeat: null,
      modelVersionRanking: null,
      mlErrors: ["python_runtime_unavailable_ts_fallback"],
    },
    runExplanation: {
      mode: "rules_only",
      note: "TypeScript rules-only fallback (context-aware v2). Start Python serving or set HEATWISE_ML_CWD for full ML.",
    },
    errors: [],
  };
}
