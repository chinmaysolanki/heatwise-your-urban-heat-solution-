-- AlterTable
ALTER TABLE "InstallationRequest" ADD COLUMN "exportJson" TEXT;

-- AlterTable
ALTER TABLE "PhotoSession" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "RecommendationCandidate" ADD COLUMN "headline" TEXT;
ALTER TABLE "RecommendationCandidate" ADD COLUMN "summary" TEXT;

-- CreateTable
CREATE TABLE "PhotoPipelineEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photoSessionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "payload" TEXT,
    CONSTRAINT "PhotoPipelineEvent_photoSessionId_fkey" FOREIGN KEY ("photoSessionId") REFERENCES "PhotoSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
