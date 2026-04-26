/**
 * Minimal rules-only slate when the Python runtime is unavailable.
 * Keep aligned in spirit with ``ml/serving/orchestration/candidate_generator.py``.
 */

import type { RecommendationGenerateRequest, RecommendationGenerateResponse, RuntimeCandidate } from "@/lib/ml/recommendationRuntimeTypes";
import { applySupplyConstraintsToRuntimeCandidates } from "@/lib/services/recommendationConstraintService";

const RULES_VERSION = "hw-rules-v1.2-ts-fallback";

function hardBlock(
  project: Record<string, unknown>,
  preferences: Record<string, unknown>,
  cand: Record<string, unknown>,
): string[] {
  const reasons: string[] = [];
  const budget = Number(project.budget_inr ?? preferences.budget_inr ?? 0);
  const cost = Number(cand.estimated_install_cost_inr ?? 0);
  if (budget > 0 && cost > budget * 1.25) reasons.push("HARD_BUDGET_EXCEEDED");
  return reasons;
}

export function buildRulesOnlyFallback(req: RecommendationGenerateRequest): RecommendationGenerateResponse {
  const project = req.project ?? {};
  const preferences = req.preferences ?? {};
  const budget = Number(project.budget_inr ?? preferences.budget_inr ?? 80_000);

  const templates: Record<string, unknown>[] = [
    {
      candidate_id: `cand_ts_${Math.random().toString(36).slice(2, 10)}`,
      recommendation_type: "planter",
      greenery_density: "medium",
      planter_type: "raised",
      irrigation_type: "drip",
      shade_solution: "pergola",
      cooling_strategy: "evapotranspiration",
      maintenance_level_pred: "low",
      species_mix_type: "duo",
      species_count_estimate: 2,
      estimated_install_cost_inr: Math.min(45_000, budget * 1.05),
      estimated_annual_maintenance_inr: 6000,
      expected_temp_reduction_c: 2.0,
      expected_surface_temp_reduction_c: 4.0,
      species_primary: "Spider Plant",
      species_secondary: "Spider Plant",
      species_tertiary: "Spider Plant",
      rule_template_score: 0.7,
    },
    {
      candidate_id: `cand_ts_${Math.random().toString(36).slice(2, 10)}`,
      recommendation_type: "shade_first",
      greenery_density: "low",
      planter_type: "container",
      irrigation_type: "manual",
      shade_solution: "shade_sail",
      cooling_strategy: "shading",
      maintenance_level_pred: "minimal",
      species_mix_type: "mono",
      species_count_estimate: 1,
      estimated_install_cost_inr: Math.min(30_000, budget),
      estimated_annual_maintenance_inr: 4000,
      expected_temp_reduction_c: 1.2,
      expected_surface_temp_reduction_c: 3.0,
      species_primary: "Periwinkle (Vinca)",
      species_secondary: "Periwinkle (Vinca)",
      species_tertiary: "Periwinkle (Vinca)",
      rule_template_score: 0.65,
    },
  ];

  const candidates: RuntimeCandidate[] = [];
  let rank = 1;
  for (const raw of templates.slice(0, req.maxCandidates ?? 8)) {
    const cid = String(raw.candidate_id);
    const blockReasons = hardBlock(project, preferences, raw);
    const rulePrior = Number(raw.rule_template_score ?? 0.5);
    const blocked = blockReasons.length > 0;
    candidates.push({
      candidateId: cid,
      rank: rank++,
      blocked,
      blockReasons,
      scores: {
        rulePrior,
        feasibilityMl: null,
        heatMl: null,
        rankingMl: null,
        blended: blocked ? 0 : rulePrior,
        blendParts: { rules: rulePrior },
      },
      candidatePayload: Object.fromEntries(Object.entries(raw).filter(([k]) => k !== "rule_template_score")),
      explanation: {
        summaryBullets: blocked
          ? [`Blocked: ${blockReasons.join(", ")}`]
          : [`Rule-based template (TS fallback). Primary: ${raw.species_primary}.`],
        componentScores: { rules: rulePrior },
        finalBlendedScore: blocked ? 0 : rulePrior,
        mlHeadsUsed: { feasibility: false, heat: false, ranking: false },
        blocked,
      },
    });
  }

  candidates.sort((a, b) => Number(b.scores.blended) - Number(a.scores.blended));
  candidates.forEach((c, i) => {
    c.rank = i + 1;
  });

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
      note: "TypeScript rules-only fallback; start Python serving or set HEATWISE_ML_CWD for full ML.",
    },
    errors: [],
  };
}
