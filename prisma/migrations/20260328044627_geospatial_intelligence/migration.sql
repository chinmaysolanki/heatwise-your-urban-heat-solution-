-- CreateTable
CREATE TABLE "GeoContext" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "cityTier" TEXT,
    "climateZone" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "elevationM" REAL,
    "urbanDensityBand" TEXT,
    "builtUpIndex" REAL,
    "neighborhoodHeatRiskBand" TEXT,
    "rainfallBand" TEXT,
    "windExposureRegionBand" TEXT,
    "airQualityBand" TEXT,
    "waterStressBand" TEXT,
    "sourceConfidence" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" TEXT,
    CONSTRAINT "GeoContext_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MicroclimateSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monthOfYear" INTEGER NOT NULL,
    "avgDayTempC" REAL,
    "avgNightTempC" REAL,
    "summerPeakTempC" REAL,
    "humidityPct" REAL,
    "rainfallLevel" TEXT,
    "windExposureScore" REAL,
    "sunExposureScore" REAL,
    "shadeCoverScore" REAL,
    "reflectedHeatRiskScore" REAL,
    "dustExposureScore" REAL,
    "runoffRiskScore" REAL,
    "waterAvailabilityScore" REAL,
    "seasonalHeatStressScore" REAL,
    "sourceType" TEXT NOT NULL,
    "sourceConfidence" REAL NOT NULL,
    "metadataJson" TEXT,
    CONSTRAINT "MicroclimateSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteExposureProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "orientation" TEXT,
    "floorLevel" INTEGER,
    "surroundingBuiltDensity" TEXT NOT NULL,
    "roofMaterial" TEXT,
    "surfaceType" TEXT,
    "sunlightHours" REAL,
    "shadeLevel" TEXT,
    "heatAbsorptionRiskScore" REAL NOT NULL,
    "windRiskScore" REAL NOT NULL,
    "waterRetentionRiskScore" REAL NOT NULL,
    "irrigationNeedRiskScore" REAL NOT NULL,
    "privacyExposureScore" REAL NOT NULL,
    "coolingNeedScore" REAL NOT NULL,
    "biodiversityOpportunityScore" REAL NOT NULL,
    "maintenanceStressScore" REAL NOT NULL,
    "overallSiteComplexityScore" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" TEXT,
    CONSTRAINT "SiteExposureProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeoEnrichmentSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "recommendationSessionId" TEXT,
    "geoContextId" TEXT,
    "microclimateSnapshotId" TEXT,
    "siteExposureId" TEXT,
    "enrichmentCreatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geoFeaturePayloadJson" TEXT NOT NULL,
    "microclimateFeaturePayloadJson" TEXT NOT NULL,
    "siteExposurePayloadJson" TEXT NOT NULL,
    "overallGeoConfidence" REAL NOT NULL,
    "notes" TEXT,
    CONSTRAINT "GeoEnrichmentSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GeoEnrichmentSnapshot_recommendationSessionId_fkey" FOREIGN KEY ("recommendationSessionId") REFERENCES "RecommendationTelemetrySession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GeoEnrichmentSnapshot_geoContextId_fkey" FOREIGN KEY ("geoContextId") REFERENCES "GeoContext" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GeoEnrichmentSnapshot_microclimateSnapshotId_fkey" FOREIGN KEY ("microclimateSnapshotId") REFERENCES "MicroclimateSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GeoEnrichmentSnapshot_siteExposureId_fkey" FOREIGN KEY ("siteExposureId") REFERENCES "SiteExposureProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GeoContext_projectId_idx" ON "GeoContext"("projectId");

-- CreateIndex
CREATE INDEX "GeoContext_createdAt_idx" ON "GeoContext"("createdAt");

-- CreateIndex
CREATE INDEX "MicroclimateSnapshot_projectId_idx" ON "MicroclimateSnapshot"("projectId");

-- CreateIndex
CREATE INDEX "MicroclimateSnapshot_capturedAt_idx" ON "MicroclimateSnapshot"("capturedAt");

-- CreateIndex
CREATE INDEX "SiteExposureProfile_projectId_idx" ON "SiteExposureProfile"("projectId");

-- CreateIndex
CREATE INDEX "SiteExposureProfile_createdAt_idx" ON "SiteExposureProfile"("createdAt");

-- CreateIndex
CREATE INDEX "GeoEnrichmentSnapshot_projectId_idx" ON "GeoEnrichmentSnapshot"("projectId");

-- CreateIndex
CREATE INDEX "GeoEnrichmentSnapshot_recommendationSessionId_idx" ON "GeoEnrichmentSnapshot"("recommendationSessionId");

-- CreateIndex
CREATE INDEX "GeoEnrichmentSnapshot_enrichmentCreatedAt_idx" ON "GeoEnrichmentSnapshot"("enrichmentCreatedAt");
