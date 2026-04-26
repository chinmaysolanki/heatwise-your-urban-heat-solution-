-- AlterTable
ALTER TABLE "RecommendationRun" ADD COLUMN "photoSessionId" TEXT;
ALTER TABLE "RecommendationRun" ADD COLUMN "projectId" TEXT;

-- CreateTable
CREATE TABLE "PhotoSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "projectId" TEXT,
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
    CONSTRAINT "PhotoSession_selectedCandidateId_fkey" FOREIGN KEY ("selectedCandidateId") REFERENCES "RecommendationCandidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisualizationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photoSessionId" TEXT,
    "sourcePhotoRef" TEXT,
    "recommendationId" TEXT NOT NULL,
    "layoutSchema" TEXT NOT NULL,
    "spatialMapping" TEXT NOT NULL,
    "visualizationPrompt" TEXT NOT NULL,
    "generatedImageUrl" TEXT NOT NULL,
    "generationVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "VisualizationRecord_photoSessionId_fkey" FOREIGN KEY ("photoSessionId") REFERENCES "PhotoSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
