/**
 * scoreSpeciesWithML
 * ------------------
 * Calls the trained ML species scorer (/api/ml/score-species) and returns
 * a map of species_key → { relevance_score, heat_score }.
 *
 * Used by the recommendation engine to blend ML scores with rule-based scores.
 * Falls back gracefully to empty map on any error.
 */

export type MLSpeciesScore = {
  relevance_score: number | null;
  heat_score:      number | null;
};

/** Shape the scorer expects for each species entry */
export type ScorerSpeciesInput = {
  species_key:           string;
  climate_suitability?:  string;
  sunlight_preference?:  string;
  water_demand?:         string;
  maintenance_need?:     string;
  root_aggressiveness?:  string;
  pollinator_value?:     number;
  edible?:               number;
  child_pet_safety?:     string;
  native_support?:       string;
  container_suitability?: string;
  cooling_contribution?: number;
  privacy_contribution?: number;
  growth_habit?:         string;
};

/** Scenario context passed to the scorer */
export type ScorerScenario = {
  sun?:                    "full" | "partial" | "shade";
  water_availability?:     "scarce" | "moderate" | "plentiful";
  wind_level?:             "low" | "medium" | "high";
  heat_exposure?:          "low" | "moderate" | "high" | "extreme";
  purpose_primary?:        "cooling" | "food" | "aesthetic" | "privacy" | "biodiversity" | "mixed";
  maintenance_preference?: "minimal" | "low" | "moderate" | "high";
  pet_safe_required?:      0 | 1;
  edible_preferred?:       0 | 1;
  floor_level?:            number;
  area_m2?:                number;
  space_type?:             "outdoor_rooftop" | "outdoor_balcony" | "outdoor_terrace" | "indoor";
};

/**
 * Batch-score a list of species against a scenario using the trained ML models.
 *
 * @param species  Array of species entries (from SpeciesCatalog or scoredPlants)
 * @param scenario Scenario context derived from photoSession / recommendation request
 * @param baseUrl  Base URL of the Next.js server (defaults to http://localhost:3000)
 *
 * @returns Map: species_key → MLSpeciesScore
 */
export async function scoreSpeciesWithML(
  species:  ScorerSpeciesInput[],
  scenario: ScorerScenario,
  baseUrl   = process.env.NEXTAUTH_URL ?? "http://localhost:3000",
): Promise<Map<string, MLSpeciesScore>> {
  const result = new Map<string, MLSpeciesScore>();
  if (!species.length) return result;

  try {
    const res = await fetch(`${baseUrl}/api/ml/score-species`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ species, scenario }),
    });

    if (!res.ok) return result;

    const data: { scored?: Array<{ species_key: string } & MLSpeciesScore> } = await res.json();
    for (const entry of data.scored ?? []) {
      result.set(entry.species_key, {
        relevance_score: entry.relevance_score,
        heat_score:      entry.heat_score,
      });
    }
  } catch {
    // ML scoring is best-effort — never block the recommendation
  }

  return result;
}

/**
 * Blend an ML relevance score into an existing rule-based score.
 *
 * @param ruleScore  Float [0,1] from the TypeScript catalog-hybrid engine
 * @param mlScore    Float [0,1] from scoreSpeciesWithML, or null if unavailable
 * @param mlWeight   Weight for ML score (0–1). Default 0.35 (35% ML, 65% rules).
 */
export function blendScores(
  ruleScore: number,
  mlScore:   number | null,
  mlWeight   = 0.35,
): number {
  if (mlScore === null || !Number.isFinite(mlScore)) return ruleScore;
  return ruleScore * (1 - mlWeight) + mlScore * mlWeight;
}
