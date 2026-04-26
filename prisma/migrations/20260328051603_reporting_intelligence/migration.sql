-- CreateTable
CREATE TABLE "RecommendationDossier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "recommendationSessionId" TEXT NOT NULL,
    "candidateSnapshotIdsJson" TEXT NOT NULL,
    "selectedCandidateSnapshotId" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dossierType" TEXT NOT NULL,
    "dossierVersion" TEXT NOT NULL,
    "projectContextSnapshotJson" TEXT NOT NULL,
    "recommendationSummaryJson" TEXT NOT NULL,
    "pricingSummaryJson" TEXT,
    "supplySummaryJson" TEXT,
    "personalizationSummaryJson" TEXT,
    "geospatialSummaryJson" TEXT,
    "feasibilitySummaryJson" TEXT,
    "scenarioSummaryJson" TEXT,
    "installerReadinessSummaryJson" TEXT,
    "executionNotesJson" TEXT,
    "explanationProvenanceJson" TEXT NOT NULL,
    "metadataJson" TEXT,
    CONSTRAINT "RecommendationDossier_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecommendationDossier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecommendationDossier_recommendationSessionId_fkey" FOREIGN KEY ("recommendationSessionId") REFERENCES "RecommendationTelemetrySession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecommendationDossier_selectedCandidateSnapshotId_fkey" FOREIGN KEY ("selectedCandidateSnapshotId") REFERENCES "RecommendationCandidateSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recommendationDossierId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "sectionOrder" INTEGER NOT NULL,
    "sectionTitle" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL,
    "sectionPayloadJson" TEXT NOT NULL,
    "explanationRefsJson" TEXT,
    "visibilityScope" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportSection_recommendationDossierId_fkey" FOREIGN KEY ("recommendationDossierId") REFERENCES "RecommendationDossier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportExplanation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recommendationDossierId" TEXT NOT NULL,
    "relatedSectionKey" TEXT NOT NULL,
    "explanationType" TEXT NOT NULL,
    "sourceLayer" TEXT NOT NULL,
    "sourceReferenceId" TEXT,
    "explanationPayloadJson" TEXT NOT NULL,
    "confidenceBand" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportExplanation_recommendationDossierId_fkey" FOREIGN KEY ("recommendationDossierId") REFERENCES "RecommendationDossier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstallerExecutionSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recommendationDossierId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "installJobId" TEXT,
    "executionPayloadJson" TEXT NOT NULL,
    "readinessChecklistJson" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstallerExecutionSummary_recommendationDossierId_fkey" FOREIGN KEY ("recommendationDossierId") REFERENCES "RecommendationDossier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstallerExecutionSummary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstallerExecutionSummary_installJobId_fkey" FOREIGN KEY ("installJobId") REFERENCES "InstallerInstallJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminReviewDossier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recommendationDossierId" TEXT NOT NULL,
    "reviewPayloadJson" TEXT NOT NULL,
    "riskAssessmentJson" TEXT,
    "provenanceAuditJson" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminReviewDossier_recommendationDossierId_fkey" FOREIGN KEY ("recommendationDossierId") REFERENCES "RecommendationDossier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RecommendationDossier_projectId_idx" ON "RecommendationDossier"("projectId");

-- CreateIndex
CREATE INDEX "RecommendationDossier_recommendationSessionId_idx" ON "RecommendationDossier"("recommendationSessionId");

-- CreateIndex
CREATE INDEX "RecommendationDossier_dossierType_idx" ON "RecommendationDossier"("dossierType");

-- CreateIndex
CREATE INDEX "RecommendationDossier_generatedAt_idx" ON "RecommendationDossier"("generatedAt");

-- CreateIndex
CREATE INDEX "ReportSection_recommendationDossierId_idx" ON "ReportSection"("recommendationDossierId");

-- CreateIndex
CREATE INDEX "ReportSection_sectionKey_idx" ON "ReportSection"("sectionKey");

-- CreateIndex
CREATE INDEX "ReportExplanation_recommendationDossierId_idx" ON "ReportExplanation"("recommendationDossierId");

-- CreateIndex
CREATE INDEX "ReportExplanation_sourceLayer_idx" ON "ReportExplanation"("sourceLayer");

-- CreateIndex
CREATE UNIQUE INDEX "InstallerExecutionSummary_recommendationDossierId_key" ON "InstallerExecutionSummary"("recommendationDossierId");

-- CreateIndex
CREATE INDEX "InstallerExecutionSummary_projectId_idx" ON "InstallerExecutionSummary"("projectId");

-- CreateIndex
CREATE INDEX "InstallerExecutionSummary_installJobId_idx" ON "InstallerExecutionSummary"("installJobId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminReviewDossier_recommendationDossierId_key" ON "AdminReviewDossier"("recommendationDossierId");

-- CreateIndex
CREATE INDEX "AdminReviewDossier_createdAt_idx" ON "AdminReviewDossier"("createdAt");
