-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "areaSqm" REAL,
    "aspect" TEXT,
    "floorLevel" INTEGER,
    "spaceKind" TEXT NOT NULL DEFAULT 'ROOFTOP',
    "indoor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Space_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnvironmentSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "spaceId" TEXT NOT NULL,
    "tempC" REAL,
    "sunIndex" REAL,
    "windIndex" REAL,
    "humidityPct" REAL,
    "soilPh" REAL,
    "soilMoisture" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnvironmentSnapshot_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "gardeningScore" INTEGER,
    "budgetBand" INTEGER,
    "maintenanceBand" INTEGER,
    "waterConstraint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserPreference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpeciesCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RecommendationCandidateSpecies" (
    "candidateId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,

    PRIMARY KEY ("candidateId", "speciesId"),
    CONSTRAINT "RecommendationCandidateSpecies_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "RecommendationCandidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecommendationCandidateSpecies_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "SpeciesCatalog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutcomeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "candidateId" TEXT,
    "speciesId" TEXT NOT NULL,
    "outcomeType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutcomeEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RecommendationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutcomeEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "RecommendationCandidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutcomeEvent_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "SpeciesCatalog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RecommendationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "input" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "totalCandidates" INTEGER NOT NULL,
    "projectId" TEXT,
    "photoSessionId" TEXT,
    "spaceId" TEXT,
    "environmentSnapshotId" TEXT,
    "userPreferenceId" TEXT,
    CONSTRAINT "RecommendationRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecommendationRun_photoSessionId_fkey" FOREIGN KEY ("photoSessionId") REFERENCES "PhotoSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecommendationRun_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecommendationRun_environmentSnapshotId_fkey" FOREIGN KEY ("environmentSnapshotId") REFERENCES "EnvironmentSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecommendationRun_userPreferenceId_fkey" FOREIGN KEY ("userPreferenceId") REFERENCES "UserPreference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RecommendationRun" ("createdAt", "durationMs", "id", "input", "photoSessionId", "projectId", "totalCandidates") SELECT "createdAt", "durationMs", "id", "input", "photoSessionId", "projectId", "totalCandidates" FROM "RecommendationRun";
DROP TABLE "RecommendationRun";
ALTER TABLE "new_RecommendationRun" RENAME TO "RecommendationRun";
CREATE INDEX "RecommendationRun_projectId_idx" ON "RecommendationRun"("projectId");
CREATE INDEX "RecommendationRun_photoSessionId_idx" ON "RecommendationRun"("photoSessionId");
CREATE INDEX "RecommendationRun_spaceId_idx" ON "RecommendationRun"("spaceId");
CREATE INDEX "RecommendationRun_environmentSnapshotId_idx" ON "RecommendationRun"("environmentSnapshotId");
CREATE INDEX "RecommendationRun_userPreferenceId_idx" ON "RecommendationRun"("userPreferenceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Space_projectId_idx" ON "Space"("projectId");

-- CreateIndex
CREATE INDEX "EnvironmentSnapshot_spaceId_idx" ON "EnvironmentSnapshot"("spaceId");

-- CreateIndex
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "UserPreference_projectId_idx" ON "UserPreference"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SpeciesCatalog_code_key" ON "SpeciesCatalog"("code");

-- CreateIndex
CREATE INDEX "SpeciesCatalog_category_idx" ON "SpeciesCatalog"("category");

-- CreateIndex
CREATE INDEX "RecommendationCandidateSpecies_speciesId_idx" ON "RecommendationCandidateSpecies"("speciesId");

-- CreateIndex
CREATE INDEX "OutcomeEvent_runId_idx" ON "OutcomeEvent"("runId");

-- CreateIndex
CREATE INDEX "OutcomeEvent_speciesId_idx" ON "OutcomeEvent"("speciesId");

-- CreateIndex
CREATE INDEX "OutcomeEvent_candidateId_idx" ON "OutcomeEvent"("candidateId");

-- CreateIndex
CREATE INDEX "RecommendationCandidate_runId_idx" ON "RecommendationCandidate"("runId");
