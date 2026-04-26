/**
 * Fixed recommendation scenarios for quality / regression tests.
 * See lib/recommendation/testing/README.md for the test plan.
 */

import type { RecommendationGenerateRequest } from "@/lib/ml/recommendationRuntimeTypes";

const baseProject = (over: Record<string, unknown>): Record<string, unknown> => ({
  project_type: "rooftop",
  budget_inr: 150_000,
  load_capacity_level: "medium",
  floor_level: 4,
  ...over,
});

const baseEnv = (over: Record<string, unknown>): Record<string, unknown> => ({
  water_availability: "moderate",
  water_access: true,
  sunExposure: "partial",
  ...over,
});

const basePrefs = (over: Record<string, unknown>): Record<string, unknown> => ({
  purpose_primary: "cooling",
  maintenanceLevel: "moderate",
  ...over,
});

/** Dimensions + space for layout eligibility (rooftop / terrace / balcony). */
export function layoutEligibleProject(
  space: "balcony" | "terrace" | "rooftop",
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return baseProject({
    project_type: space,
    space_kind: space,
    width_m: 3.2,
    length_m: 6.0,
    ...overrides,
  });
}

export type ScenarioExpectations = {
  /** Minimum non-blocked candidates (catalog hybrid path). */
  catalogHybridMinOpen?: number;
  /** Minimum non-blocked candidates (rules-only TS path). */
  rulesOnlyMinOpen?: number;
  /** When pet-safe required, open candidates must not be bougainvillea (hard block). */
  petSafeNoBougainvilleaOpen?: boolean;
  /** Open candidates should carry species_catalog_code (catalog hybrid). */
  catalogHybridCodesRequired?: boolean;
  /** For edible-focused scenarios, at least one open candidate should use an edible catalog code. */
  edibleCodeAmongOpen?: boolean;
  /** getLayoutEligibility(body).eligible */
  layoutEligible?: boolean;
  /** Budget cap for rough install sanity (optional). */
  maxBudgetInr?: number;
  /** When environment water is scarce, open candidates must not use sprinkler/mist irrigation. */
  waterScarceNoSprinklerMistOpen?: boolean;
  /** Open candidates must not use any of these catalog codes (regression / fit checks). */
  forbiddenOpenCatalogCodes?: string[];
  /** At least one open candidate must use a code from this list (e.g. hot-arid cooling anchors). */
  requireOpenCatalogCodeOneOf?: string[];
  /** At least one of ``codes`` must appear among the first ``topN`` open candidates. */
  requireOpenCatalogCodeOneOfInTop?: { topN: number; codes: string[] };
  /** Among the first ``k`` open candidates, at least ``min`` must be in EDIBLE_CATALOG_CODES. */
  edibleDominanceTopOpen?: { k: number; min: number };
  /** First ``topN`` open candidates must not use any of these catalog codes. */
  forbiddenOpenCatalogCodesInTop?: { topN: number; codes: string[] };
};

export type RecommendationTestScenario = {
  id: string;
  title: string;
  request: RecommendationGenerateRequest;
  expect: ScenarioExpectations;
};

/** Edible SpeciesCatalog codes (subset; aligned with seed). */
export const EDIBLE_CATALOG_CODES = new Set([
  "tulsi_holy",
  "basil_sweet",
  "mint",
  "coriander",
  "curry_leaf",
  "lemongrass",
  "cherry_tomato",
  "chilli",
  "malabar_spinach",
  "portulaca",
  "zinnia",
  "okra",
  "luffa",
  "beans_bush",
]);

export const RECOMMENDATION_TEST_SCENARIOS: RecommendationTestScenario[] = [
  {
    id: "sunny_balcony_low_maintenance",
    title: "Sunny balcony, low maintenance",
    request: {
      project: layoutEligibleProject("balcony", {
        budget_inr: 90_000,
        floor_level: 5,
      }),
      environment: baseEnv({
        sunExposure: "full",
        sunlight_hours: 8,
      }),
      preferences: basePrefs({
        maintenanceLevel: "minimal",
      }),
      maxCandidates: 6,
    },
    expect: {
      catalogHybridMinOpen: 1,
      rulesOnlyMinOpen: 1,
      catalogHybridCodesRequired: true,
      layoutEligible: true,
      maxBudgetInr: 90_000,
    },
  },
  {
    id: "hot_terrace_cooling",
    title: "Hot terrace, cooling-first",
    request: {
      project: layoutEligibleProject("terrace", {
        budget_inr: 200_000,
        load_capacity_level: "high",
      }),
      environment: baseEnv({
        sunExposure: "full",
        sunlight_hours: 9,
        region: "hot_arid",
      }),
      preferences: basePrefs({
        purpose_primary: "cooling",
        maintenanceLevel: "low",
      }),
      maxCandidates: 8,
    },
    expect: {
      catalogHybridMinOpen: 1,
      rulesOnlyMinOpen: 1,
      catalogHybridCodesRequired: true,
      layoutEligible: true,
      requireOpenCatalogCodeOneOfInTop: {
        topN: 6,
        codes: ["prickly_pear", "sedum", "vetiver", "portulaca", "lemongrass_dense"],
      },
      forbiddenOpenCatalogCodesInTop: {
        topN: 5,
        codes: ["bougainvillea", "plumeria"],
      },
    },
  },
  {
    id: "shaded_balcony_aesthetic",
    title: "Shaded balcony, aesthetic goal",
    request: {
      project: layoutEligibleProject("balcony"),
      environment: baseEnv({
        sunExposure: "shade",
        shade_level: "heavy",
        sunlight_hours: 2.5,
      }),
      preferences: basePrefs({
        purpose_primary: "aesthetic",
        maintenanceLevel: "moderate",
      }),
      maxCandidates: 6,
    },
    expect: {
      catalogHybridMinOpen: 1,
      catalogHybridCodesRequired: true,
      layoutEligible: true,
      forbiddenOpenCatalogCodes: ["bougainvillea", "hibiscus", "plumeria", "portulaca", "zinnia"],
    },
  },
  {
    id: "pet_safe_home_garden",
    title: "Pet-safe home garden",
    request: {
      project: layoutEligibleProject("rooftop", { budget_inr: 120_000 }),
      environment: baseEnv({ sunExposure: "partial", sunlight_hours: 5 }),
      preferences: basePrefs({
        child_pet_safe_required: 1,
        maintenanceLevel: "low",
      }),
      maxCandidates: 8,
    },
    expect: {
      catalogHybridMinOpen: 1,
      petSafeNoBougainvilleaOpen: true,
      catalogHybridCodesRequired: true,
      layoutEligible: true,
      forbiddenOpenCatalogCodes: ["bougainvillea", "hibiscus", "curry_leaf", "vinca", "geranium_pelargonium", "lemongrass", "mint"],
      forbiddenOpenCatalogCodesInTop: {
        topN: 5,
        codes: ["bamboo_dwarf", "areca_palm_dwarf"],
      },
    },
  },
  {
    id: "edible_herb_setup",
    title: "Edible / herb-focused",
    request: {
      project: layoutEligibleProject("rooftop", { budget_inr: 100_000 }),
      environment: baseEnv({ sunExposure: "partial", sunlight_hours: 6, water_access: true }),
      preferences: basePrefs({
        purpose_primary: "food",
        maintenanceLevel: "moderate",
      }),
      maxCandidates: 8,
    },
    expect: {
      catalogHybridMinOpen: 1,
      edibleCodeAmongOpen: true,
      catalogHybridCodesRequired: true,
      layoutEligible: true,
      forbiddenOpenCatalogCodes: ["bougainvillea", "hibiscus", "ixora"],
      edibleDominanceTopOpen: { k: 5, min: 3 },
    },
  },
  {
    id: "windy_highrise_balcony",
    title: "Windy high-rise balcony",
    request: {
      project: layoutEligibleProject("balcony", {
        floor_level: 22,
        load_capacity_level: "low",
        budget_inr: 85_000,
      }),
      environment: baseEnv({
        sunExposure: "partial",
        windLevel: "high",
        wind_exposure: "high",
      }),
      preferences: basePrefs({ maintenanceLevel: "minimal" }),
      maxCandidates: 6,
    },
    expect: {
      catalogHybridMinOpen: 1,
      catalogHybridCodesRequired: true,
      layoutEligible: true,
    },
  },
  {
    id: "water_scarce_terrace",
    title: "Scarce water — open candidates must not pair sprinkler/mist with scarce water",
    request: {
      project: layoutEligibleProject("terrace"),
      environment: baseEnv({
        water_availability: "scarce",
        water_access: false,
        waterAccess: false,
      }),
      preferences: basePrefs({}),
      maxCandidates: 6,
    },
    expect: {
      catalogHybridMinOpen: 1,
      catalogHybridCodesRequired: true,
      layoutEligible: true,
      waterScarceNoSprinklerMistOpen: true,
      forbiddenOpenCatalogCodes: ["hibiscus", "bamboo_dwarf", "areca_palm_dwarf", "caladium", "lemongrass"],
      requireOpenCatalogCodeOneOfInTop: {
        topN: 3,
        codes: ["sedum", "prickly_pear", "portulaca", "adenium"],
      },
      forbiddenOpenCatalogCodesInTop: {
        topN: 3,
        codes: ["bougainvillea", "plumeria"],
      },
    },
  },
];
