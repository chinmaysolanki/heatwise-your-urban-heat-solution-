import type { GeoEnrichmentBundle } from "@/lib/ml/geoIntelligenceTypes";
import type {
  RecommendationEvaluationContext,
  RecommendationGenerateResponse,
} from "@/lib/ml/recommendationRuntimeTypes";
import { db } from "@/lib/db";
import { computeGeoContext } from "@/lib/services/geoContextService";
import { buildGeoExplanationLayer } from "@/lib/services/geoExplanationService";
import { computeMicroclimate } from "@/lib/services/microclimateService";
import { computeSiteExposure } from "@/lib/services/siteExposureService";

const GEO_RULES_VERSION = "hw-geo-rules-v1.0";

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function buildGeoEnrichmentBundle(
  project: Record<string, unknown>,
  environment: Record<string, unknown>,
  preferences: Record<string, unknown>,
  evaluationContext: RecommendationEvaluationContext | null,
): GeoEnrichmentBundle {
  const geoContext = computeGeoContext(project, environment, evaluationContext);
  const siteExposure = computeSiteExposure(project, environment, preferences);
  const microclimate = computeMicroclimate(project, environment, preferences, geoContext);

  const overallGeoConfidence = clamp01(
    (geoContext.sourceConfidence * 0.35 +
      microclimate.sourceConfidence * 0.35 +
      (0.55 + siteExposure.overallSiteComplexityScore * 0.2) * 0.3),
  );

  const explanation = buildGeoExplanationLayer(geoContext, microclimate, siteExposure, overallGeoConfidence);

  const environmentPatch: Record<string, number | string | boolean> = {
    geo_rules_version: GEO_RULES_VERSION,
    geo_overall_confidence: overallGeoConfidence,
    geo_cooling_need_score: siteExposure.coolingNeedScore,
    geo_heat_absorption_risk_score: siteExposure.heatAbsorptionRiskScore,
    geo_wind_risk_score: siteExposure.windRiskScore,
    geo_water_retention_risk_score: siteExposure.waterRetentionRiskScore,
    geo_irrigation_need_risk_score: siteExposure.irrigationNeedRiskScore,
    geo_privacy_exposure_score: siteExposure.privacyExposureScore,
    geo_biodiversity_opportunity_score: siteExposure.biodiversityOpportunityScore,
    geo_maintenance_stress_score: siteExposure.maintenanceStressScore,
    geo_overall_site_complexity_score: siteExposure.overallSiteComplexityScore,
    geo_seasonal_heat_stress_score: microclimate.seasonalHeatStressScore ?? 0.5,
    geo_sun_exposure_score: microclimate.sunExposureScore ?? 0.5,
    geo_micro_wind_exposure: microclimate.windExposureScore ?? 0.5,
    geo_shade_cover_score: microclimate.shadeCoverScore ?? 0.5,
    geo_water_availability_score: microclimate.waterAvailabilityScore ?? 0.5,
    geo_coarse_enrichment: !(geoContext.latitude != null && geoContext.longitude != null),
  };

  return {
    geoContext,
    microclimate,
    siteExposure,
    explanation,
    environmentPatch,
    overallGeoConfidence,
  };
}

export function mergeGeoIntoEnvironment(
  environment: Record<string, unknown>,
  bundle: GeoEnrichmentBundle,
): Record<string, unknown> {
  return { ...environment, ...bundle.environmentPatch };
}

export function attachGeoExplanationToCandidates(
  out: RecommendationGenerateResponse,
  explanation: GeoEnrichmentBundle["explanation"],
): RecommendationGenerateResponse {
  const candidates = out.candidates.map((c) => ({
    ...c,
    explanation: {
      ...c.explanation,
      geo_risk_summary_json: explanation.geo_risk_summary_json,
      heat_exposure_note: explanation.heat_exposure_note,
      wind_exposure_note: explanation.wind_exposure_note,
      irrigation_risk_note: explanation.irrigation_risk_note,
      seasonal_stress_note: explanation.seasonal_stress_note,
      cooling_opportunity_note: explanation.cooling_opportunity_note,
      biodiversity_opportunity_note: explanation.biodiversity_opportunity_note,
      confidence_note: explanation.confidence_note,
      location_specific_adjustments_json: explanation.location_specific_adjustments_json,
    },
  }));
  return { ...out, candidates };
}

export async function persistGeoEnrichmentChain(input: {
  projectId: string;
  recommendationSessionId?: string | null;
  bundle: GeoEnrichmentBundle;
}): Promise<string> {
  const { bundle, projectId, recommendationSessionId } = input;
  const g = bundle.geoContext;
  const m = bundle.microclimate;
  const s = bundle.siteExposure;

  const row = await db.$transaction(async (tx) => {
    const geoRow = await tx.geoContext.create({
      data: {
        projectId,
        region: g.region,
        city: g.city,
        cityTier: g.cityTier ?? undefined,
        climateZone: g.climateZone,
        latitude: g.latitude ?? undefined,
        longitude: g.longitude ?? undefined,
        elevationM: g.elevationM ?? undefined,
        urbanDensityBand: g.urbanDensityBand ?? undefined,
        builtUpIndex: g.builtUpIndex ?? undefined,
        neighborhoodHeatRiskBand: g.neighborhoodHeatRiskBand ?? undefined,
        rainfallBand: g.rainfallBand ?? undefined,
        windExposureRegionBand: g.windExposureRegionBand ?? undefined,
        airQualityBand: g.airQualityBand ?? undefined,
        waterStressBand: g.waterStressBand ?? undefined,
        sourceConfidence: g.sourceConfidence,
        metadataJson: JSON.stringify({ rulesVersion: GEO_RULES_VERSION }),
      },
    });

    const microRow = await tx.microclimateSnapshot.create({
      data: {
        projectId,
        monthOfYear: m.monthOfYear,
        avgDayTempC: m.avgDayTempC ?? undefined,
        avgNightTempC: m.avgNightTempC ?? undefined,
        summerPeakTempC: m.summerPeakTempC ?? undefined,
        humidityPct: m.humidityPct ?? undefined,
        rainfallLevel: m.rainfallLevel ?? undefined,
        windExposureScore: m.windExposureScore ?? undefined,
        sunExposureScore: m.sunExposureScore ?? undefined,
        shadeCoverScore: m.shadeCoverScore ?? undefined,
        reflectedHeatRiskScore: m.reflectedHeatRiskScore ?? undefined,
        dustExposureScore: m.dustExposureScore ?? undefined,
        runoffRiskScore: m.runoffRiskScore ?? undefined,
        waterAvailabilityScore: m.waterAvailabilityScore ?? undefined,
        seasonalHeatStressScore: m.seasonalHeatStressScore ?? undefined,
        sourceType: m.sourceType,
        sourceConfidence: m.sourceConfidence,
        metadataJson: undefined,
      },
    });

    const siteRow = await tx.siteExposureProfile.create({
      data: {
        projectId,
        projectType: s.projectType,
        orientation: s.orientation ?? undefined,
        floorLevel: s.floorLevel ?? undefined,
        surroundingBuiltDensity: s.surroundingBuiltDensity,
        roofMaterial: s.roofMaterial ?? undefined,
        surfaceType: s.surfaceType ?? undefined,
        sunlightHours: s.sunlightHours ?? undefined,
        shadeLevel: s.shadeLevel ?? undefined,
        heatAbsorptionRiskScore: s.heatAbsorptionRiskScore,
        windRiskScore: s.windRiskScore,
        waterRetentionRiskScore: s.waterRetentionRiskScore,
        irrigationNeedRiskScore: s.irrigationNeedRiskScore,
        privacyExposureScore: s.privacyExposureScore,
        coolingNeedScore: s.coolingNeedScore,
        biodiversityOpportunityScore: s.biodiversityOpportunityScore,
        maintenanceStressScore: s.maintenanceStressScore,
        overallSiteComplexityScore: s.overallSiteComplexityScore,
        metadataJson: undefined,
      },
    });

    const snap = await tx.geoEnrichmentSnapshot.create({
      data: {
        projectId,
        recommendationSessionId: recommendationSessionId ?? undefined,
        geoContextId: geoRow.id,
        microclimateSnapshotId: microRow.id,
        siteExposureId: siteRow.id,
        geoFeaturePayloadJson: JSON.stringify(g),
        microclimateFeaturePayloadJson: JSON.stringify(m),
        siteExposurePayloadJson: JSON.stringify(s),
        overallGeoConfidence: bundle.overallGeoConfidence,
        notes: bundle.explanation.confidence_note,
      },
    });
    return snap;
  });

  return row.id;
}
