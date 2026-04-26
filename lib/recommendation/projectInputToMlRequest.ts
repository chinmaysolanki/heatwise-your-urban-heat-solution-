import type { ProjectInput } from "@/models";
import type { RecommendationGenerateRequest } from "@/lib/ml/recommendationRuntimeTypes";

const BUDGET_INR: Record<ProjectInput["budgetRange"], number> = {
  low: 45_000,
  medium: 85_000,
  high: 160_000,
  premium: 280_000,
};

/**
 * Map layout `ProjectInput` (generate-layout) to ML runtime `RecommendationGenerateRequest`.
 * Keeps keys aligned with `ml/serving/orchestration/candidate_generator.py`.
 */
export function projectInputToMlRequest(
  input: ProjectInput,
  opts: { projectId?: string | null; maxCandidates?: number } = {},
): RecommendationGenerateRequest {
  const area = Math.max(1, input.widthM * input.lengthM);
  const budget = BUDGET_INR[input.budgetRange] ?? 85_000;
  const sunHours = input.sunExposure === "full" ? 8 : input.sunExposure === "partial" ? 5 : 3;

  return {
    project: {
      project_type: input.spaceType,
      space_kind: input.spaceType,
      budget_inr: budget,
      floor_level: input.floorLevel,
      width_m: input.widthM,
      length_m: input.lengthM,
      area_sqm: area,
      ...(input.latitude != null ? { latitude: input.latitude } : {}),
      ...(input.longitude != null ? { longitude: input.longitude } : {}),
    },
    environment: {
      sunExposure: input.sunExposure,
      sunlight_hours: sunHours,
      shade_level: input.sunExposure === "shade" ? "heavy" : input.sunExposure === "partial" ? "partial" : "light",
      windLevel: input.windLevel,
      wind_exposure: input.windLevel,
      water_access: input.waterAccess ? 1 : 0,
      waterAccess: input.waterAccess,
    },
    preferences: {
      purpose_primary:
        input.primaryGoal === "food"
          ? "food"
          : input.primaryGoal === "aesthetic"
            ? "aesthetic"
            : "cooling",
      maintenanceLevel: input.maintenanceLevel,
      budget_pref: input.budgetRange,
      child_pet_safe_required: 0,
    },
    projectId: opts.projectId ?? undefined,
    maxCandidates: opts.maxCandidates ?? 8,
  };
}
