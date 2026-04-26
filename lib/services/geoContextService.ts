import type { GeoContextComputed } from "@/lib/ml/geoIntelligenceTypes";
import {
  resolveClimateZone,
  resolveSupplyRegion,
} from "@/lib/services/recommendationConstraintService";

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown, d = ""): string {
  return v != null && String(v).trim() ? String(v).trim() : d;
}

function inferCity(project: Record<string, unknown>, environment: Record<string, unknown>): string {
  const c = str(project.city ?? environment.city);
  if (c) return c;
  const loc = str(project.location);
  if (loc.includes(",")) {
    const tail = loc.split(",").pop()?.trim();
    if (tail) return tail;
  }
  return loc || "unknown";
}

/**
 * Coarse geo context: region/climate bands with optional lat/lon refinement.
 */
export function computeGeoContext(
  project: Record<string, unknown>,
  environment: Record<string, unknown>,
  evaluationContext: { climateZone?: string | null; cityTier?: string | null; region?: string | null } | null,
): GeoContextComputed {
  const region =
    resolveSupplyRegion(project, environment, evaluationContext as never) ?? str(environment.region, "unknown");
  const city = inferCity(project, environment);
  const climateZone = resolveClimateZone(environment, evaluationContext as never);
  const cityTier = str(evaluationContext?.cityTier ?? project.city_tier ?? environment.city_tier) || null;

  const lat = num(project.latitude ?? project.lat ?? environment.latitude);
  const lon = num(project.longitude ?? project.lng ?? environment.longitude);
  const elev = num(project.elevation_m ?? environment.elevation_m);

  const cz = climateZone.toLowerCase();
  let heatRisk = "moderate";
  if (cz.includes("tropical") || cz.includes("arid")) heatRisk = "high";
  if (cz.includes("temperate") || cz.includes("subtropical")) heatRisk = "moderate";

  let rainfall = "moderate";
  if (cz.includes("arid") || cz.includes("semi")) rainfall = "low";
  if (cz.includes("tropical") && cz.includes("humid")) rainfall = "high";

  let windBand = "moderate";
  if (region.toLowerCase().includes("coast")) windBand = "elevated";

  let urban = str(environment.urban_density_band ?? project.urban_density, "medium").toLowerCase();
  let builtIdx = num(environment.built_up_index ?? environment.heat_island_score);
  if (builtIdx == null) {
    builtIdx = urban.includes("high") || urban.includes("dense") ? 0.72 : urban.includes("low") ? 0.35 : 0.5;
  }

  let air = str(environment.air_quality_band ?? environment.air_quality, "moderate").toLowerCase();
  let waterStress = str(environment.water_stress_band ?? environment.water_stress, "moderate").toLowerCase();

  const exact =
    lat != null &&
    lon != null &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180;
  let sourceConfidence = exact ? 0.82 : region !== "unknown" ? 0.58 : 0.42;
  if (cityTier === "tier1" || cityTier === "metro") sourceConfidence += 0.05;

  return {
    region,
    city,
    cityTier: cityTier || null,
    climateZone,
    latitude: lat,
    longitude: lon,
    elevationM: elev,
    urbanDensityBand: urban || null,
    builtUpIndex: builtIdx,
    neighborhoodHeatRiskBand: heatRisk,
    rainfallBand: rainfall,
    windExposureRegionBand: windBand,
    airQualityBand: air || null,
    waterStressBand: waterStress || null,
    sourceConfidence: Math.max(0.25, Math.min(0.95, sourceConfidence)),
  };
}
