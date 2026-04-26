import type { ProjectInput, BudgetRange, MaintenanceLevel, UserGoal, SpaceType, SunExposure, WindLevel } from "@/models";
import type { RecommendationGenerateRequest } from "@/lib/ml/recommendationRuntimeTypes";

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function budgetInrToRange(inr: number): BudgetRange {
  if (inr < 60_000) return "low";
  if (inr < 120_000) return "medium";
  if (inr < 220_000) return "high";
  return "premium";
}

/**
 * Derive a typed ProjectInput for `runPipeline` when the canonical API received
 * RecommendationGenerateRequest-shaped JSON. Returns null if required fields are missing.
 */
export function recommendationRequestToProjectInput(body: RecommendationGenerateRequest): ProjectInput | null {
  const p = body.project ?? {};
  const e = body.environment ?? {};
  const pref = body.preferences ?? {};

  const rawSpace = (p.space_kind ?? p.spaceType ?? p.project_type ?? "") as string;
  const spaceType = rawSpace.toLowerCase().trim();
  if (spaceType !== "rooftop" && spaceType !== "terrace" && spaceType !== "balcony") {
    return null;
  }

  const widthM = num(p.width_m ?? p.widthM, NaN);
  const lengthM = num(p.length_m ?? p.lengthM, NaN);
  if (!Number.isFinite(widthM) || !Number.isFinite(lengthM)) {
    return null;
  }

  const floorLevel = Math.round(num(p.floor_level ?? p.floorLevel, 1));

  let sunExposure: SunExposure = "full";
  const sunRaw = String(e.sunExposure ?? e.sun_exposure ?? "full").toLowerCase();
  if (sunRaw === "shade" || sunRaw === "shaded") sunExposure = "shade";
  else if (sunRaw === "partial") sunExposure = "partial";

  let windLevel: WindLevel = "medium";
  const windRaw = String(e.windLevel ?? e.wind_exposure ?? "medium").toLowerCase();
  if (windRaw === "low") windLevel = "low";
  else if (windRaw === "high") windLevel = "high";
  else if (windRaw === "moderate") windLevel = "medium";
  else if (windRaw === "medium") windLevel = "medium";

  const waterAccess = Boolean(e.waterAccess ?? e.water_access ?? true);

  let budgetRange: BudgetRange = "medium";
  const prefBand = pref.budget_pref ?? pref.budgetRange;
  if (typeof prefBand === "string") {
    const b = prefBand.toLowerCase();
    if (b === "low" || b === "medium" || b === "high" || b === "premium") {
      budgetRange = b;
    }
  }
  const budgetInr = num(p.budget_inr ?? pref.budget_inr, NaN);
  if (Number.isFinite(budgetInr) && prefBand == null) {
    budgetRange = budgetInrToRange(budgetInr);
  }

  let maintenanceLevel: MaintenanceLevel = "moderate";
  const maintRaw = String(pref.maintenanceLevel ?? pref.maintenance_level ?? "moderate").toLowerCase();
  if (maintRaw === "minimal" || maintRaw === "low") maintenanceLevel = "minimal";
  else if (maintRaw === "active" || maintRaw === "high") maintenanceLevel = "active";

  let primaryGoal: UserGoal = "cooling";
  const purpose = String(pref.purpose_primary ?? pref.primaryGoal ?? "cooling").toLowerCase();
  if (purpose === "food" || purpose === "edible") primaryGoal = "food";
  else if (purpose === "aesthetic") primaryGoal = "aesthetic";
  else if (purpose === "mixed") primaryGoal = "mixed";

  const latitude = p.latitude != null ? num(p.latitude, NaN) : undefined;
  const longitude = p.longitude != null ? num(p.longitude, NaN) : undefined;

  return {
    spaceType: spaceType as SpaceType,
    widthM,
    lengthM,
    floorLevel,
    sunExposure,
    windLevel,
    waterAccess,
    budgetRange,
    maintenanceLevel,
    primaryGoal,
    ...(Number.isFinite(latitude!) ? { latitude } : {}),
    ...(Number.isFinite(longitude!) ? { longitude } : {}),
  };
}
