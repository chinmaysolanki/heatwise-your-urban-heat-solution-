-- CreateTable
CREATE TABLE "UserSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "amountInr" INTEGER NOT NULL,
    "currentPeriodStart" DATETIME NOT NULL,
    "currentPeriodEnd" DATETIME NOT NULL,
    "razorpay_order_id" TEXT,
    "razorpay_payment_id" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecommendationRuntimeObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT,
    "observationKind" TEXT NOT NULL DEFAULT 'success',
    "outcomeHttpStatus" INTEGER,
    "errorCode" TEXT,
    "errorMessageTruncated" TEXT,
    "requestFingerprint" TEXT NOT NULL DEFAULT 'unknown',
    "trafficChannel" TEXT NOT NULL DEFAULT 'canonical',
    "runtimePathCategory" TEXT NOT NULL,
    "generatorSource" TEXT,
    "mlMode" TEXT,
    "heatwiseServingOk" BOOLEAN,
    "candidateTotal" INTEGER NOT NULL,
    "candidateOpen" INTEGER NOT NULL,
    "candidatesWithSpeciesCode" INTEGER NOT NULL,
    "layoutRecommendationCount" INTEGER NOT NULL DEFAULT 0,
    "layoutUnresolvedIdentityCount" INTEGER NOT NULL DEFAULT 0,
    "layoutSlateStatus" TEXT,
    "layoutFailureCode" TEXT,
    "fallbackReasonTag" TEXT,
    "mlErrorsTruncated" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PhotoSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "projectId" TEXT,
    "userId" TEXT,
    "capturedAt" DATETIME,
    "photoData" TEXT,
    "photoMime" TEXT,
    "photoWidth" INTEGER,
    "photoHeight" INTEGER,
    "measurementStatus" TEXT,
    "widthM" REAL,
    "lengthM" REAL,
    "floorLevel" INTEGER,
    "measurementCompletedAt" DATETIME,
    "recommendationJson" TEXT,
    "layoutSchema" TEXT,
    "spatialMapping" TEXT,
    "visualizationImageUrl" TEXT,
    "visualizationPrompt" TEXT,
    "selectedCandidateId" TEXT,
    "environmentSnapshotId" TEXT,
    "session_context_json" TEXT,
    CONSTRAINT "PhotoSession_selectedCandidateId_fkey" FOREIGN KEY ("selectedCandidateId") REFERENCES "RecommendationCandidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PhotoSession_environmentSnapshotId_fkey" FOREIGN KEY ("environmentSnapshotId") REFERENCES "EnvironmentSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PhotoSession" ("capturedAt", "createdAt", "environmentSnapshotId", "floorLevel", "id", "layoutSchema", "lengthM", "measurementCompletedAt", "measurementStatus", "photoData", "photoHeight", "photoMime", "photoWidth", "projectId", "recommendationJson", "selectedCandidateId", "session_context_json", "spatialMapping", "updatedAt", "userId", "visualizationImageUrl", "visualizationPrompt", "widthM") SELECT "capturedAt", "createdAt", "environmentSnapshotId", "floorLevel", "id", "layoutSchema", "lengthM", "measurementCompletedAt", "measurementStatus", "photoData", "photoHeight", "photoMime", "photoWidth", "projectId", "recommendationJson", "selectedCandidateId", "session_context_json", "spatialMapping", "updatedAt", "userId", "visualizationImageUrl", "visualizationPrompt", "widthM" FROM "PhotoSession";
DROP TABLE "PhotoSession";
ALTER TABLE "new_PhotoSession" RENAME TO "PhotoSession";
CREATE INDEX "PhotoSession_environmentSnapshotId_idx" ON "PhotoSession"("environmentSnapshotId");
CREATE TABLE "new_RecommendationTelemetryEvent" (
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
    "recommendationRunId" TEXT,
    CONSTRAINT "RecommendationTelemetryEvent_recommendationRunId_fkey" FOREIGN KEY ("recommendationRunId") REFERENCES "RecommendationRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecommendationTelemetryEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RecommendationTelemetrySession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecommendationTelemetryEvent_candidateSnapshotId_fkey" FOREIGN KEY ("candidateSnapshotId") REFERENCES "RecommendationCandidateSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RecommendationTelemetryEvent" ("candidateSnapshotId", "dwellTimeMs", "eventSource", "eventTimestamp", "eventType", "eventValue", "feedbackEventId", "id", "metadataJson", "projectId", "recommendationRunId", "screenName", "sessionId", "uiPosition", "userId") SELECT "candidateSnapshotId", "dwellTimeMs", "eventSource", "eventTimestamp", "eventType", "eventValue", "feedbackEventId", "id", "metadataJson", "projectId", "recommendationRunId", "screenName", "sessionId", "uiPosition", "userId" FROM "RecommendationTelemetryEvent";
DROP TABLE "RecommendationTelemetryEvent";
ALTER TABLE "new_RecommendationTelemetryEvent" RENAME TO "RecommendationTelemetryEvent";
CREATE UNIQUE INDEX "RecommendationTelemetryEvent_feedbackEventId_key" ON "RecommendationTelemetryEvent"("feedbackEventId");
CREATE INDEX "RecommendationTelemetryEvent_sessionId_idx" ON "RecommendationTelemetryEvent"("sessionId");
CREATE INDEX "RecommendationTelemetryEvent_projectId_idx" ON "RecommendationTelemetryEvent"("projectId");
CREATE INDEX "RecommendationTelemetryEvent_eventType_idx" ON "RecommendationTelemetryEvent"("eventType");
CREATE INDEX "RecommendationTelemetryEvent_eventTimestamp_idx" ON "RecommendationTelemetryEvent"("eventTimestamp");
CREATE INDEX "RecommendationTelemetryEvent_recommendationRunId_idx" ON "RecommendationTelemetryEvent"("recommendationRunId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_userId_key" ON "UserSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_razorpay_order_id_key" ON "UserSubscription"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_razorpay_payment_id_key" ON "UserSubscription"("razorpay_payment_id");

-- CreateIndex
CREATE INDEX "UserSubscription_status_idx" ON "UserSubscription"("status");

-- CreateIndex
CREATE INDEX "UserSubscription_currentPeriodEnd_idx" ON "UserSubscription"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "RecommendationRuntimeObservation_createdAt_idx" ON "RecommendationRuntimeObservation"("createdAt");

-- CreateIndex
CREATE INDEX "RecommendationRuntimeObservation_runtimePathCategory_idx" ON "RecommendationRuntimeObservation"("runtimePathCategory");

-- CreateIndex
CREATE INDEX "RecommendationRuntimeObservation_generatorSource_idx" ON "RecommendationRuntimeObservation"("generatorSource");

-- CreateIndex
CREATE INDEX "RecommendationRuntimeObservation_projectId_idx" ON "RecommendationRuntimeObservation"("projectId");

-- CreateIndex
CREATE INDEX "RecommendationRuntimeObservation_requestFingerprint_idx" ON "RecommendationRuntimeObservation"("requestFingerprint");

-- CreateIndex
CREATE INDEX "RecommendationRuntimeObservation_trafficChannel_idx" ON "RecommendationRuntimeObservation"("trafficChannel");

-- CreateIndex
CREATE INDEX "RecommendationRuntimeObservation_observationKind_idx" ON "RecommendationRuntimeObservation"("observationKind");
