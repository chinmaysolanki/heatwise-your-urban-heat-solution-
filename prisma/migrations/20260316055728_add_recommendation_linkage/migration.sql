-- CreateTable
CREATE TABLE "RecommendationFeedbackEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "recommendationId" TEXT NOT NULL,
    "projectId" TEXT,
    "action" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "dwellMs" INTEGER,
    "scoreBefore" REAL,
    "scoreAfter" REAL,
    "notes" TEXT,
    "extra" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidateId" TEXT,
    CONSTRAINT "RecommendationFeedbackEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "RecommendationCandidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecommendationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "input" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "totalCandidates" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "RecommendationCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "layoutName" TEXT NOT NULL,
    "costEstimate" TEXT NOT NULL,
    "heatEstimate" TEXT NOT NULL,
    "layoutSchema" TEXT NOT NULL,
    "spatialMapping" TEXT,
    "heatReductionSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationCandidate_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RecommendationRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationFeedbackEvent_eventId_key" ON "RecommendationFeedbackEvent"("eventId");
