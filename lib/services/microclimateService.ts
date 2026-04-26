import type { MicroclimateComputed } from "@/lib/ml/geoIntelligenceTypes";
import type { GeoContextComputed } from "@/lib/ml/geoIntelligenceTypes";

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

export function computeMicroclimate(
  project: Record<string, unknown>,
  environment: Record<string, unknown>,
  preferences: Record<string, unknown>,
  geo: GeoContextComputed,
): MicroclimateComputed {
  const month =
    (typeof preferences.month_of_year === "number" && preferences.month_of_year >= 1 && preferences.month_of_year <= 12
      ? preferences.month_of_year
      : null) ?? new Date().getMonth() + 1;

  const dayT = num(environment.temp_c ?? environment.tempC ?? environment.avg_day_temp_c);
  const nightT = num(environment.night_temp_c ?? environment.avg_night_temp_c);
  const peakSurf = num(environment.peak_surface_temp_c ?? environment.peakSurfaceTempC);
  const hum = num(environment.humidity_pct ?? environment.humidityPct);
  const rain = str(environment.rainfall_level ?? environment.rainfallLevel, geo.rainfallBand ?? "moderate");
  const windIdx = num(environment.wind_index ?? environment.windIndex) ?? 0.5;
  const sunH =
    num(environment.sunlight_hours ?? environment.sunlightHours) ??
    num(project.sunlight_hours) ??
    6;

  let sunExp = clamp01(sunH / 12 + (windIdx > 0.65 ? 0.05 : 0));
  const shLv = str(environment.shade_level ?? environment.shadeLevel);
  let shadeCover = clamp01(1 - sunExp * 0.85 + (shLv.includes("heavy") ? 0.2 : 0));

  let reflected = 0.35;
  if (peakSurf != null && peakSurf > 48) reflected += 0.25;
  if (geo.neighborhoodHeatRiskBand === "high" || geo.neighborhoodHeatRiskBand === "very_high") reflected += 0.15;
  reflected = clamp01(reflected);

  let dust = 0.3;
  if (geo.airQualityBand === "poor" || geo.airQualityBand === "very_poor") dust += 0.25;
  dust = clamp01(dust);

  let runoff = 0.35;
  if (rain.includes("heavy") || rain.includes("monsoon")) runoff += 0.2;
  if (str(environment.drainage_quality).includes("poor")) runoff += 0.15;
  runoff = clamp01(runoff);

  let waterAvail = 0.65;
  if (geo.waterStressBand === "high" || geo.waterStressBand === "extreme") waterAvail -= 0.35;
  if (rain.includes("low") || rain.includes("arid")) waterAvail -= 0.2;
  waterAvail = clamp01(waterAvail);

  let seasonalHeat = 0.5;
  if (geo.climateZone.toLowerCase().includes("tropical")) seasonalHeat += 0.15;
  if (geo.climateZone.toLowerCase().includes("arid")) seasonalHeat += 0.12;
  if (month >= 4 && month <= 9) seasonalHeat += 0.1;
  if (dayT != null && dayT > 34) seasonalHeat += 0.12;
  seasonalHeat = clamp01(seasonalHeat);

  const windMicro = clamp01(windIdx * 0.7 + (geo.windExposureRegionBand?.includes("high") ? 0.2 : 0));

  const hasInstrument = dayT != null || hum != null || peakSurf != null;
  const coarse = !geo.latitude && !geo.longitude;
  let conf = hasInstrument ? 0.78 : coarse ? 0.48 : 0.62;
  if (geo.sourceConfidence < 0.55) conf *= 0.9;

  return {
    monthOfYear: month,
    avgDayTempC: dayT,
    avgNightTempC: nightT,
    summerPeakTempC: peakSurf,
    humidityPct: hum,
    rainfallLevel: rain || null,
    windExposureScore: windMicro,
    sunExposureScore: sunExp,
    shadeCoverScore: shadeCover,
    reflectedHeatRiskScore: reflected,
    dustExposureScore: dust,
    runoffRiskScore: runoff,
    waterAvailabilityScore: waterAvail,
    seasonalHeatStressScore: seasonalHeat,
    sourceType: hasInstrument ? "instrument_merge" : coarse ? "region_coarse" : "site_proxy",
    sourceConfidence: clamp01(conf),
  };
}
