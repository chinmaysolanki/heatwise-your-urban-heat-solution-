import type { Recommendation, UserGoal } from "@/models";
import type { RecommendationGenerateResponse, RuntimeCandidate } from "@/lib/ml/recommendationRuntimeTypes";
import {
  resolveSpeciesIdentity,
  resolveSpeciesIdentityFromRuntimeCandidate,
} from "@/lib/species/resolveSpeciesCatalogCode";

/**
 * Heuristic affinity between 3D layout template and ML rule candidate (0–3+).
 */
function templateMlAffinity(
  templateId: string,
  templateType: string,
  primaryGoal: UserGoal,
  ml: RuntimeCandidate,
): number {
  const p = ml.candidatePayload as Record<string, unknown>;
  const recType = String(p.recommendation_type ?? "");
  const shade = String(p.shade_solution ?? "").toLowerCase();

  if (templateId.includes("shade_sail") || templateId.includes("container_garden_shade")) {
    if (recType === "shade_first" || shade.includes("sail")) return 4;
    if (recType === "planter") return 1.5;
    return 0.5;
  }

  if (templateId === "rooftop_food_garden" || primaryGoal === "food") {
    if (recType === "planter") return 3;
    return 0.8;
  }

  if (templateType === "vertical" || templateId.includes("pergola") || templateId.includes("vertical")) {
    if (shade.includes("pergola") || shade.includes("green_wall")) return 4;
    if (recType === "planter") return 2;
    return 0.6;
  }

  if (recType === "planter") return 2.5;
  if (recType === "shade_first") return 0.8;
  return 0.5;
}

function layoutOrderScore(
  rec: Recommendation,
  primaryGoal: UserGoal,
  mlActive: RuntimeCandidate[],
): number {
  const tpl = rec.candidate.template;
  let best = 0;
  for (const mc of mlActive) {
    const aff = templateMlAffinity(tpl.id, tpl.type, primaryGoal, mc);
    const blended = Number(mc.scores?.blended ?? 0);
    best = Math.max(best, aff * 0.35 + blended);
  }
  return best;
}

/**
 * Reorder layout recommendations using ML blended scores + template affinity,
 * attach ML payload for UI/telemetry, and surface model-ranked species in copy + primary plant label.
 */
export function mergeMlIntoLayoutRecommendations(
  recommendations: Recommendation[],
  ml: RecommendationGenerateResponse | null,
  primaryGoal: UserGoal,
): Recommendation[] {
  if (!recommendations.length || !ml?.candidates?.length) {
    return recommendations;
  }

  const mlActive = ml.candidates
    .filter((c) => !c.blocked)
    .sort((a, b) => Number(b.scores?.blended ?? 0) - Number(a.scores?.blended ?? 0));

  if (mlActive.length === 0) {
    return recommendations;
  }

  const sortedRecs = [...recommendations].sort(
    (a, b) => layoutOrderScore(b, primaryGoal, mlActive) - layoutOrderScore(a, primaryGoal, mlActive),
  );

  const used = new Set<string>();

  return sortedRecs.map((rec, index) => {
    const tpl = rec.candidate.template;
    let best: RuntimeCandidate | null = null;
    let bestKey = -Infinity;

    for (const mc of mlActive) {
      if (used.has(mc.candidateId)) continue;
      const aff = templateMlAffinity(tpl.id, tpl.type, primaryGoal, mc);
      const blended = Number(mc.scores?.blended ?? 0);
      const key = aff * 2 + blended;
      if (key > bestKey) {
        bestKey = key;
        best = mc;
      }
    }

    if (!best) {
      best = mlActive.find((mc) => !used.has(mc.candidateId)) ?? mlActive[0]!;
    }
    used.add(best.candidateId);

    const p = best.candidatePayload as Record<string, unknown>;
    const species = String(p.species_primary ?? "").trim();
    const dt = p.expected_temp_reduction_c;
    const surf = p.expected_surface_temp_reduction_c;
    const blend = best.scores?.blended;

    const mlLine =
      species || dt != null || blend != null
        ? [
            "Model-ranked mix:",
            species || "species TBD",
            dt != null ? `~${Number(dt).toFixed(1)}°C air Δ` : null,
            surf != null ? `~${Number(surf).toFixed(1)}°C surface Δ` : null,
            blend != null ? `score ${Number(blend).toFixed(2)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "";

    let candidate = rec.candidate;
    const topPlant = candidate.scoredPlants?.[0]?.plant;
    const idRef = resolveSpeciesIdentity({
      enginePlantId: topPlant?.id ?? null,
      mlSpeciesLabel: species || null,
    });
    if (candidate.scoredPlants?.[0]) {
      candidate = {
        ...candidate,
        scoredPlants: candidate.scoredPlants.map((sp, j) =>
          j === 0
            ? {
                ...sp,
                plant: {
                  ...sp.plant,
                  ...(species ? { name: species } : {}),
                  speciesCatalogCode: idRef.catalogCode,
                  speciesIdentityResolution: idRef.resolution,
                },
              }
            : sp,
        ),
      };
    }

    const augmented: Recommendation = {
      ...rec,
      rank: index + 1,
      candidate,
      primarySpeciesIdentity: idRef,
      explanation: mlLine
        ? {
            ...rec.explanation,
            summary: `${rec.explanation.summary}\n\n${mlLine}`.trim(),
          }
        : rec.explanation,
    };

    const ext = augmented as Recommendation & {
      mlCandidate?: RuntimeCandidate;
      mlTelemetry?: RecommendationGenerateResponse["telemetryMeta"];
      mlRunMode?: string;
    };
    const heatwiseSpecies = resolveSpeciesIdentityFromRuntimeCandidate(best, topPlant?.id ?? null);
    ext.mlCandidate = { ...best, heatwiseSpeciesResolution: heatwiseSpecies };
    ext.mlTelemetry = ml.telemetryMeta;
    ext.mlRunMode = ml.mode;

    return augmented;
  });
}
