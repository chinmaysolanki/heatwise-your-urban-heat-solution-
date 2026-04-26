-- CreateTable
CREATE TABLE "RecommendationInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "windowStart" DATETIME NOT NULL,
    "windowEnd" DATETIME NOT NULL,
    "insightType" TEXT NOT NULL,
    "scopeJson" TEXT NOT NULL,
    "metricsJson" TEXT NOT NULL,
    "evidenceRefsJson" TEXT NOT NULL,
    "sourceLayersJson" TEXT NOT NULL,
    "recommendationDossierId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" TEXT
);

-- CreateTable
CREATE TABLE "VariantPerformance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "windowStart" DATETIME NOT NULL,
    "windowEnd" DATETIME NOT NULL,
    "experimentId" TEXT,
    "rolloutVariant" TEXT,
    "recommendationType" TEXT,
    "scenarioUsageTag" TEXT,
    "reportDossierType" TEXT,
    "generatorSource" TEXT,
    "rulesVersion" TEXT,
    "modelVersion" TEXT,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "avgBlendedScore" REAL,
    "avgLatencyMs" REAL,
    "verifiedInstallCount" INTEGER NOT NULL DEFAULT 0,
    "dossierCreatedCount" INTEGER NOT NULL DEFAULT 0,
    "followupCompletedCount" INTEGER NOT NULL DEFAULT 0,
    "commercialInstalledCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" TEXT
);

-- CreateTable
CREATE TABLE "SegmentPerformance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "windowStart" DATETIME NOT NULL,
    "windowEnd" DATETIME NOT NULL,
    "segmentKey" TEXT NOT NULL,
    "projectType" TEXT,
    "climateZone" TEXT,
    "budgetBand" TEXT,
    "region" TEXT,
    "userType" TEXT,
    "installerAvailabilityBand" TEXT,
    "personalizationConfidenceBand" TEXT,
    "metricsJson" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" TEXT
);

-- CreateTable
CREATE TABLE "LessonMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonKey" TEXT NOT NULL,
    "polarity" TEXT NOT NULL,
    "confidenceBand" TEXT NOT NULL,
    "summaryStructuredJson" TEXT NOT NULL,
    "evidenceRefsJson" TEXT NOT NULL,
    "relatedSegmentKey" TEXT,
    "relatedRecommendationPatternsJson" TEXT,
    "effectiveFrom" DATETIME,
    "effectiveTo" DATETIME,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "metadataJson" TEXT
);

-- CreateIndex
CREATE INDEX "RecommendationInsight_windowStart_windowEnd_idx" ON "RecommendationInsight"("windowStart", "windowEnd");

-- CreateIndex
CREATE INDEX "RecommendationInsight_insightType_idx" ON "RecommendationInsight"("insightType");

-- CreateIndex
CREATE INDEX "VariantPerformance_windowStart_windowEnd_idx" ON "VariantPerformance"("windowStart", "windowEnd");

-- CreateIndex
CREATE INDEX "VariantPerformance_experimentId_rolloutVariant_idx" ON "VariantPerformance"("experimentId", "rolloutVariant");

-- CreateIndex
CREATE INDEX "VariantPerformance_generatorSource_rulesVersion_idx" ON "VariantPerformance"("generatorSource", "rulesVersion");

-- CreateIndex
CREATE INDEX "SegmentPerformance_windowStart_windowEnd_idx" ON "SegmentPerformance"("windowStart", "windowEnd");

-- CreateIndex
CREATE INDEX "SegmentPerformance_segmentKey_idx" ON "SegmentPerformance"("segmentKey");

-- CreateIndex
CREATE UNIQUE INDEX "LessonMemory_lessonKey_key" ON "LessonMemory"("lessonKey");

-- CreateIndex
CREATE INDEX "LessonMemory_polarity_idx" ON "LessonMemory"("polarity");

-- CreateIndex
CREATE INDEX "LessonMemory_confidenceBand_idx" ON "LessonMemory"("confidenceBand");
