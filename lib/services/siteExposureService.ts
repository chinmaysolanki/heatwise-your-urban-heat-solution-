import type { SiteExposureComputed } from "@/lib/ml/geoIntelligenceTypes";
import { resolveProjectType } from "@/lib/services/recommendationConstraintService";

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown, d = ""): string {
  return v != null && String(v).trim() ? String(v).trim() : d;
}

/**
 * Deterministic site exposure scores (0–1) from project + environment snapshots.
 */
export function computeSiteExposure(
  project: Record<string, unknown>,
  environment: Record<string, unknown>,
  preferences: Record<string, unknown>,
): SiteExposureComputed {
  const ptype = resolveProjectType(project);
  const surface = str(project.surfaceType).toLowerCase();
  const roofMat = str(project.roof_material ?? project.roofMaterial ?? environment.roof_material).toLowerCase();
  const orientation = str(project.orientation ?? environment.orientation) || null;
  const floorLevel = num(project.floor_level ?? project.floorLevel ?? environment.floor_level) ?? null;
  const built = str(
    project.surrounding_built_density ?? environment.surrounding_built_density ?? environment.built_up_level,
    "medium",
  ).toLowerCase();

  const sunH =
    num(environment.sunlight_hours ?? environment.sunlightHours) ??
    num(project.sunlight_hours) ??
    6;
  const shadeLv = str(environment.shade_level ?? environment.shadeLevel ?? project.shade_level, "partial").toLowerCase();

  let heatAbs = 0.45;
  if (surface.includes("concrete") || surface.includes("tile") || roofMat.includes("metal")) heatAbs += 0.18;
  if (sunH > 8) heatAbs += 0.12;
  if (shadeLv === "minimal" || shadeLv === "none") heatAbs += 0.14;
  if (shadeLv === "heavy" || shadeLv === "high") heatAbs -= 0.12;
  heatAbs = clamp01(heatAbs);

  let wind = 0.35;
  if (ptype.includes("balcony") && floorLevel != null && floorLevel >= 6) wind += 0.22;
  if (ptype.includes("rooftop") || ptype.includes("terrace")) wind += 0.12;
  if (built.includes("dense") || built.includes("urban_core")) wind -= 0.08;
  wind = clamp01(wind);

  const drainage = str(environment.drainage_quality ?? environment.drainage, "moderate").toLowerCase();
  let waterRet = 0.4;
  if (drainage.includes("poor")) waterRet += 0.25;
  if (surface.includes("grass") || surface.includes("soil")) waterRet -= 0.1;
  waterRet = clamp01(waterRet);

  const waterAvail = str(environment.water_availability ?? environment.waterAvailability, "moderate").toLowerCase();
  let irrNeed = 0.45;
  if (waterAvail.includes("low") || waterAvail.includes("scarce")) irrNeed += 0.22;
  if (heatAbs > 0.65) irrNeed += 0.1;
  irrNeed = clamp01(irrNeed);

  const purpose = str(preferences.purpose_primary).toLowerCase();
  let privacy = 0.35;
  if (purpose.includes("privacy")) privacy += 0.35;
  if (built.includes("dense")) privacy += 0.12;
  privacy = clamp01(privacy);

  let coolingNeed = clamp01(heatAbs * 0.55 + (sunH / 12) * 0.35 + (1 - (shadeLv.includes("heavy") ? 0.8 : 0.3)) * 0.15);

  let bio = 0.42;
  if (shadeLv.includes("partial") || shadeLv === "moderate") bio += 0.18;
  if (built.includes("low") || built.includes("suburban")) bio += 0.1;
  if (heatAbs > 0.75) bio -= 0.08;
  bio = clamp01(bio);

  let maint = 0.4;
  if (irrNeed > 0.6) maint += 0.15;
  if (heatAbs > 0.65) maint += 0.1;
  maint = clamp01(maint);

  const complexity = clamp01(
    (heatAbs + wind + waterRet + irrNeed + maint + coolingNeed) / 6,
  );

  return {
    projectType: ptype,
    orientation,
    floorLevel: floorLevel != null ? Math.round(floorLevel) : null,
    surroundingBuiltDensity: built || "medium",
    roofMaterial: roofMat || null,
    surfaceType: surface || null,
    sunlightHours: sunH,
    shadeLevel: shadeLv || null,
    heatAbsorptionRiskScore: heatAbs,
    windRiskScore: wind,
    waterRetentionRiskScore: waterRet,
    irrigationNeedRiskScore: irrNeed,
    privacyExposureScore: privacy,
    coolingNeedScore: coolingNeed,
    biodiversityOpportunityScore: bio,
    maintenanceStressScore: maint,
    overallSiteComplexityScore: complexity,
  };
}
