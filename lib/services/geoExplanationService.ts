import type {
  GeoContextComputed,
  GeoExplanationLayer,
  MicroclimateComputed,
  SiteExposureComputed,
} from "@/lib/ml/geoIntelligenceTypes";

function jsonStringify(obj: unknown): string {
  return JSON.stringify(obj);
}

export function buildGeoExplanationLayer(
  geo: GeoContextComputed,
  micro: MicroclimateComputed,
  site: SiteExposureComputed,
  overallConfidence: number,
): GeoExplanationLayer {
  const summary = {
    region: geo.region,
    city: geo.city,
    climate_zone: geo.climateZone,
    coarse_mode: !(geo.latitude != null && geo.longitude != null),
    heat_risk_band: geo.neighborhoodHeatRiskBand,
    rainfall_band: geo.rainfallBand,
    cooling_need: site.coolingNeedScore,
    wind_exposure: site.windRiskScore,
    irrigation_stress: site.irrigationNeedRiskScore,
    seasonal_heat_stress: micro.seasonalHeatStressScore,
  };

  let heatNote =
    site.heatAbsorptionRiskScore > 0.68
      ? "This rooftop faces high afternoon heat exposure due to strong sun and heat-retaining surface context."
      : site.heatAbsorptionRiskScore > 0.52
        ? "Moderate heat absorption risk — shading and species choice matter."
        : "Heat absorption context appears moderate relative to typical urban sites.";

  if (micro.reflectedHeatRiskScore != null && micro.reflectedHeatRiskScore > 0.55) {
    heatNote += " Reflected / radiant heat may amplify peak surface temperatures.";
  }

  const windNote =
    site.windRiskScore > 0.72
      ? "Wind exposure appears elevated, so lighter unstable configurations were downweighted in ranking."
      : site.windRiskScore > 0.5
        ? "Wind exposure is noticeable — secure structural elements for shade systems."
        : "Wind exposure appears typical for the site context.";

  const irrNote =
    site.irrigationNeedRiskScore > 0.65
      ? "Water stress and heat push irrigation needs up — favor drought-tolerant mixes or efficient irrigation."
      : "Irrigation demand looks manageable with standard planning.";

  const seasonalNote =
    (micro.seasonalHeatStressScore ?? 0) > 0.62
      ? "Seasonal heat stress is elevated for this month/climate — timing and species hardiness matter."
      : "Seasonal stress is within a typical band for the selected climate zone.";

  const coolNote =
    site.coolingNeedScore > 0.62
      ? "Cooling benefit is expected to be higher than average due to strong local heat stress — greening and shade payoffs are amplified."
      : "Cooling opportunity is meaningful but not extreme versus regional baseline.";

  const bioNote =
    site.biodiversityOpportunityScore > 0.55
      ? "Moderate shade and context support polyculture / biodiversity-forward layouts."
      : "Biodiversity options exist but may be limited by exposure or maintenance envelope.";

  const confNote =
    overallConfidence > 0.7
      ? "Location signals are fairly confident (instruments or precise context)."
      : overallConfidence > 0.5
        ? "Enrichment uses regional proxies — refine with on-site readings for tighter confidence."
        : "Coarse region-only enrichment — treat microclimate scores as directional, not exact.";

  const adjustments = {
    ranking_bias_cooling_greening: site.coolingNeedScore > 0.62 ? 0.02 : 0,
    ranking_bias_shade_structures: site.heatAbsorptionRiskScore > 0.65 ? 0.015 : 0,
    wind_sensitive_penalty: site.windRiskScore > 0.72 ? -0.012 : 0,
  };

  return {
    geo_risk_summary_json: jsonStringify(summary),
    heat_exposure_note: heatNote,
    wind_exposure_note: windNote,
    irrigation_risk_note: irrNote,
    seasonal_stress_note: seasonalNote,
    cooling_opportunity_note: coolNote,
    biodiversity_opportunity_note: bioNote,
    confidence_note: confNote,
    location_specific_adjustments_json: jsonStringify(adjustments),
  };
}
