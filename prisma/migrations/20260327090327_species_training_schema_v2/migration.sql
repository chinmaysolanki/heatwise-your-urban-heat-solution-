/*
  Warnings:

  - You are about to drop the `RecommendationCandidateSpecies` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `createdAt` on the `OutcomeEvent` table. All the data in the column will be lost.
  - You are about to drop the column `outcomeType` on the `OutcomeEvent` table. All the data in the column will be lost.
  - Added the required column `eventKind` to the `OutcomeEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `SpeciesCatalog` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "RecommendationCandidateSpecies_speciesId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "RecommendationCandidateSpecies";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OutcomeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "candidateId" TEXT,
    "speciesId" TEXT NOT NULL,
    "eventKind" TEXT NOT NULL,
    "survived30d" BOOLEAN,
    "survived90d" BOOLEAN,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "removedReason" TEXT,
    "healthScore" REAL,
    "source" TEXT,
    "metadataJson" TEXT,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutcomeEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RecommendationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutcomeEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "RecommendationCandidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutcomeEvent_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "SpeciesCatalog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OutcomeEvent" ("candidateId", "id", "runId", "speciesId") SELECT "candidateId", "id", "runId", "speciesId" FROM "OutcomeEvent";
DROP TABLE "OutcomeEvent";
ALTER TABLE "new_OutcomeEvent" RENAME TO "OutcomeEvent";
CREATE INDEX "OutcomeEvent_runId_idx" ON "OutcomeEvent"("runId");
CREATE INDEX "OutcomeEvent_speciesId_idx" ON "OutcomeEvent"("speciesId");
CREATE INDEX "OutcomeEvent_candidateId_idx" ON "OutcomeEvent"("candidateId");
CREATE INDEX "OutcomeEvent_eventKind_idx" ON "OutcomeEvent"("eventKind");
CREATE INDEX "OutcomeEvent_recordedAt_idx" ON "OutcomeEvent"("recordedAt");
CREATE TABLE "new_RecommendationCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "rankScore" REAL,
    "recommendationId" TEXT NOT NULL,
    "layoutName" TEXT NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "costEstimate" TEXT NOT NULL,
    "heatEstimate" TEXT NOT NULL,
    "layoutSchema" TEXT NOT NULL,
    "spatialMapping" TEXT,
    "heatReductionSummary" TEXT,
    "speciesId" TEXT,
    "shown" BOOLEAN NOT NULL DEFAULT false,
    "clicked" BOOLEAN NOT NULL DEFAULT false,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "installed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationCandidate_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RecommendationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecommendationCandidate_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "SpeciesCatalog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RecommendationCandidate" ("costEstimate", "createdAt", "headline", "heatEstimate", "heatReductionSummary", "id", "layoutName", "layoutSchema", "rank", "recommendationId", "runId", "spatialMapping", "summary") SELECT "costEstimate", "createdAt", "headline", "heatEstimate", "heatReductionSummary", "id", "layoutName", "layoutSchema", "rank", "recommendationId", "runId", "spatialMapping", "summary" FROM "RecommendationCandidate";
DROP TABLE "RecommendationCandidate";
ALTER TABLE "new_RecommendationCandidate" RENAME TO "RecommendationCandidate";
CREATE INDEX "RecommendationCandidate_runId_idx" ON "RecommendationCandidate"("runId");
CREATE INDEX "RecommendationCandidate_speciesId_idx" ON "RecommendationCandidate"("speciesId");
CREATE INDEX "RecommendationCandidate_runId_rank_idx" ON "RecommendationCandidate"("runId", "rank");
CREATE TABLE "new_SpeciesCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "scientificName" TEXT,
    "family" TEXT,
    "category" TEXT,
    "droughtTolerance" TEXT,
    "sunExposure" TEXT,
    "hardinessZoneMin" INTEGER,
    "hardinessZoneMax" INTEGER,
    "maxHeightCm" REAL,
    "growthHabit" TEXT,
    "nativeRangeNotes" TEXT,
    "invasiveRisk" TEXT,
    "ruleTagsJson" TEXT,
    "mlWeight" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SpeciesCatalog" ("category", "code", "createdAt", "displayName", "id") SELECT "category", "code", "createdAt", "displayName", "id" FROM "SpeciesCatalog";
DROP TABLE "SpeciesCatalog";
ALTER TABLE "new_SpeciesCatalog" RENAME TO "SpeciesCatalog";
CREATE UNIQUE INDEX "SpeciesCatalog_code_key" ON "SpeciesCatalog"("code");
CREATE INDEX "SpeciesCatalog_category_idx" ON "SpeciesCatalog"("category");
CREATE INDEX "SpeciesCatalog_active_idx" ON "SpeciesCatalog"("active");
CREATE INDEX "SpeciesCatalog_family_idx" ON "SpeciesCatalog"("family");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RecommendationRun_projectId_spaceId_idx" ON "RecommendationRun"("projectId", "spaceId");
