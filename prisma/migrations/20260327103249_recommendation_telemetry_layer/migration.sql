-- CreateTable
CREATE TABLE "RecommendationTelemetrySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "photoSessionId" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelVersion" TEXT NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "generatorSource" TEXT NOT NULL,
    "projectSnapshotJson" TEXT NOT NULL,
    "environmentSnapshotJson" TEXT NOT NULL,
    "preferenceSnapshotJson" TEXT NOT NULL,
    "totalCandidates" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "legacyRecommendationRunId" TEXT,
    "idempotencyKey" TEXT,
    CONSTRAINT "RecommendationTelemetrySession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecommendationTelemetrySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecommendationTelemetrySession_photoSessionId_fkey" FOREIGN KEY ("photoSessionId") REFERENCES "PhotoSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecommendationTelemetrySession_legacyRecommendationRunId_fkey" FOREIGN KEY ("legacyRecommendationRunId") REFERENCES "RecommendationRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecommendationCandidateSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "candidateRank" INTEGER NOT NULL,
    "candidateScore" REAL,
    "candidateSource" TEXT NOT NULL,
    "candidatePayloadJson" TEXT NOT NULL,
    "speciesPayloadJson" TEXT,
    "estimatedInstallCostInr" REAL,
    "estimatedMaintenanceCostInr" REAL,
    "expectedTempReductionC" REAL,
    "expectedSurfaceTempReductionC" REAL,
    "feasibilityScore" REAL,
    "safetyScore" REAL,
    "heatMitigationScore" REAL,
    "waterEfficiencyScore" REAL,
    "wasShownToUser" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RecommendationCandidateSnapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RecommendationTelemetrySession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecommendationTelemetryEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feedbackEventId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "candidateSnapshotId" TEXT,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventTimestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventSource" TEXT NOT NULL,
    "screenName" TEXT,
    "uiPosition" INTEGER,
    "dwellTimeMs" INTEGER,
    "eventValue" TEXT,
    "metadataJson" TEXT,
    CONSTRAINT "RecommendationTelemetryEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RecommendationTelemetrySession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecommendationTelemetryEvent_candidateSnapshotId_fkey" FOREIGN KEY ("candidateSnapshotId") REFERENCES "RecommendationCandidateSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstallOutcomeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "telemetrySessionId" TEXT,
    "selectedCandidateSnapshotId" TEXT,
    "installerId" TEXT,
    "installStatus" TEXT NOT NULL,
    "installDate" DATETIME,
    "actualInstallCostInr" REAL,
    "actualMaintenancePlanInr" REAL,
    "installedAreaSqft" REAL,
    "irrigationInstalled" BOOLEAN,
    "speciesInstalledJson" TEXT,
    "deviationsFromRecommendationJson" TEXT,
    "userSatisfactionScore" REAL,
    "installerFeasibilityRating" REAL,
    "measuredTempChangeC" REAL,
    "measuredSurfaceTempChangeC" REAL,
    "plantSurvivalRate30d" REAL,
    "plantSurvivalRate90d" REAL,
    "maintenanceAdherenceScore" REAL,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstallOutcomeRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstallOutcomeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InstallOutcomeRecord_telemetrySessionId_fkey" FOREIGN KEY ("telemetrySessionId") REFERENCES "RecommendationTelemetrySession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InstallOutcomeRecord_selectedCandidateSnapshotId_fkey" FOREIGN KEY ("selectedCandidateSnapshotId") REFERENCES "RecommendationCandidateSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationTelemetrySession_legacyRecommendationRunId_key" ON "RecommendationTelemetrySession"("legacyRecommendationRunId");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationTelemetrySession_idempotencyKey_key" ON "RecommendationTelemetrySession"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RecommendationTelemetrySession_projectId_idx" ON "RecommendationTelemetrySession"("projectId");

-- CreateIndex
CREATE INDEX "RecommendationTelemetrySession_userId_idx" ON "RecommendationTelemetrySession"("userId");

-- CreateIndex
CREATE INDEX "RecommendationTelemetrySession_photoSessionId_idx" ON "RecommendationTelemetrySession"("photoSessionId");

-- CreateIndex
CREATE INDEX "RecommendationTelemetrySession_generatedAt_idx" ON "RecommendationTelemetrySession"("generatedAt");

-- CreateIndex
CREATE INDEX "RecommendationCandidateSnapshot_sessionId_idx" ON "RecommendationCandidateSnapshot"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationCandidateSnapshot_sessionId_candidateRank_key" ON "RecommendationCandidateSnapshot"("sessionId", "candidateRank");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationTelemetryEvent_feedbackEventId_key" ON "RecommendationTelemetryEvent"("feedbackEventId");

-- CreateIndex
CREATE INDEX "RecommendationTelemetryEvent_sessionId_idx" ON "RecommendationTelemetryEvent"("sessionId");

-- CreateIndex
CREATE INDEX "RecommendationTelemetryEvent_projectId_idx" ON "RecommendationTelemetryEvent"("projectId");

-- CreateIndex
CREATE INDEX "RecommendationTelemetryEvent_eventType_idx" ON "RecommendationTelemetryEvent"("eventType");

-- CreateIndex
CREATE INDEX "RecommendationTelemetryEvent_eventTimestamp_idx" ON "RecommendationTelemetryEvent"("eventTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "InstallOutcomeRecord_idempotencyKey_key" ON "InstallOutcomeRecord"("idempotencyKey");

-- CreateIndex
CREATE INDEX "InstallOutcomeRecord_projectId_idx" ON "InstallOutcomeRecord"("projectId");

-- CreateIndex
CREATE INDEX "InstallOutcomeRecord_telemetrySessionId_idx" ON "InstallOutcomeRecord"("telemetrySessionId");

-- CreateIndex
CREATE INDEX "InstallOutcomeRecord_installStatus_idx" ON "InstallOutcomeRecord"("installStatus");
