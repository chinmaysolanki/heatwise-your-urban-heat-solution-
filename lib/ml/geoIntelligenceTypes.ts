/** Geospatial / microclimate layer types (avoid circular imports with recommendationRuntimeTypes). */

export type GeoEvalContext = {
  climateZone?: string | null;
  cityTier?: string | null;
  region?: string | null;
};

export type GeoContextComputed = {
  region: string;
  city: string;
  cityTier: string | null;
  climateZone: string;
  latitude: number | null;
  longitude: number | null;
  elevationM: number | null;
  urbanDensityBand: string | null;
  builtUpIndex: number | null;
  neighborhoodHeatRiskBand: string | null;
  rainfallBand: string | null;
  windExposureRegionBand: string | null;
  airQualityBand: string | null;
  waterStressBand: string | null;
  sourceConfidence: number;
};

export type MicroclimateComputed = {
  monthOfYear: number;
  avgDayTempC: number | null;
  avgNightTempC: number | null;
  summerPeakTempC: number | null;
  humidityPct: number | null;
  rainfallLevel: string | null;
  windExposureScore: number | null;
  sunExposureScore: number | null;
  shadeCoverScore: number | null;
  reflectedHeatRiskScore: number | null;
  dustExposureScore: number | null;
  runoffRiskScore: number | null;
  waterAvailabilityScore: number | null;
  seasonalHeatStressScore: number | null;
  sourceType: string;
  sourceConfidence: number;
};

export type SiteExposureComputed = {
  projectType: string;
  orientation: string | null;
  floorLevel: number | null;
  surroundingBuiltDensity: string;
  roofMaterial: string | null;
  surfaceType: string | null;
  sunlightHours: number | null;
  shadeLevel: string | null;
  heatAbsorptionRiskScore: number;
  windRiskScore: number;
  waterRetentionRiskScore: number;
  irrigationNeedRiskScore: number;
  privacyExposureScore: number;
  coolingNeedScore: number;
  biodiversityOpportunityScore: number;
  maintenanceStressScore: number;
  overallSiteComplexityScore: number;
};

export type GeoExplanationLayer = {
  geo_risk_summary_json: string;
  heat_exposure_note: string;
  wind_exposure_note: string;
  irrigation_risk_note: string;
  seasonal_stress_note: string;
  cooling_opportunity_note: string;
  biodiversity_opportunity_note: string;
  confidence_note: string;
  location_specific_adjustments_json: string;
};

export type GeoEnrichmentBundle = {
  geoContext: GeoContextComputed;
  microclimate: MicroclimateComputed;
  siteExposure: SiteExposureComputed;
  explanation: GeoExplanationLayer;
  environmentPatch: Record<string, number | string | boolean>;
  overallGeoConfidence: number;
};
