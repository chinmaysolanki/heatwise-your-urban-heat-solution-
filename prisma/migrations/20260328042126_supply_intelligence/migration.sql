-- CreateTable
CREATE TABLE "SpeciesAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "speciesName" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "cityTier" TEXT,
    "supplierSourceType" TEXT NOT NULL,
    "availabilityStatus" TEXT NOT NULL,
    "availabilityConfidence" REAL NOT NULL DEFAULT 0.8,
    "estimatedLeadTimeDays" INTEGER,
    "seasonalAvailabilityNote" TEXT,
    "substituteSpeciesJson" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MaterialInventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "region" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "availabilityStatus" TEXT NOT NULL,
    "stockBand" TEXT NOT NULL,
    "estimatedLeadTimeDays" INTEGER,
    "compatibleSolutionTypesJson" TEXT NOT NULL DEFAULT '[]',
    "supplierSourceType" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SeasonalWindow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "region" TEXT NOT NULL,
    "climateZone" TEXT NOT NULL,
    "projectType" TEXT,
    "speciesName" TEXT,
    "solutionType" TEXT,
    "startMonth" INTEGER NOT NULL,
    "endMonth" INTEGER NOT NULL,
    "suitabilityLevel" TEXT NOT NULL,
    "riskFlagsJson" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RegionalSupplyReadiness" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "region" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "solutionType" TEXT NOT NULL,
    "installerCoverageScore" REAL NOT NULL,
    "speciesAvailabilityScore" REAL NOT NULL,
    "materialsAvailabilityScore" REAL NOT NULL,
    "irrigationReadinessScore" REAL NOT NULL,
    "structuralExecutionReadinessScore" REAL NOT NULL,
    "seasonalReadinessScore" REAL NOT NULL,
    "overallSupplyReadinessScore" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RecommendationConstraintSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "recommendationSessionId" TEXT,
    "region" TEXT NOT NULL,
    "climateZone" TEXT NOT NULL,
    "monthOfYear" INTEGER NOT NULL,
    "constraintFlagsJson" TEXT NOT NULL,
    "blockedSpeciesJson" TEXT NOT NULL,
    "blockedMaterialsJson" TEXT NOT NULL,
    "blockedSolutionTypesJson" TEXT NOT NULL,
    "allowedSubstitutionsJson" TEXT NOT NULL,
    "supplyReadinessScore" REAL NOT NULL,
    "seasonalReadinessScore" REAL NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationConstraintSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecommendationConstraintSnapshot_recommendationSessionId_fkey" FOREIGN KEY ("recommendationSessionId") REFERENCES "RecommendationTelemetrySession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SpeciesAvailability_region_speciesName_idx" ON "SpeciesAvailability"("region", "speciesName");

-- CreateIndex
CREATE INDEX "MaterialInventory_region_materialType_idx" ON "MaterialInventory"("region", "materialType");

-- CreateIndex
CREATE INDEX "SeasonalWindow_region_climateZone_idx" ON "SeasonalWindow"("region", "climateZone");

-- CreateIndex
CREATE INDEX "RegionalSupplyReadiness_region_idx" ON "RegionalSupplyReadiness"("region");

-- CreateIndex
CREATE UNIQUE INDEX "RegionalSupplyReadiness_region_projectType_solutionType_key" ON "RegionalSupplyReadiness"("region", "projectType", "solutionType");

-- CreateIndex
CREATE INDEX "RecommendationConstraintSnapshot_projectId_idx" ON "RecommendationConstraintSnapshot"("projectId");

-- CreateIndex
CREATE INDEX "RecommendationConstraintSnapshot_recommendationSessionId_idx" ON "RecommendationConstraintSnapshot"("recommendationSessionId");

-- CreateIndex
CREATE INDEX "RecommendationConstraintSnapshot_generatedAt_idx" ON "RecommendationConstraintSnapshot"("generatedAt");
