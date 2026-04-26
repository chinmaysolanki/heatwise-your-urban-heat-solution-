-- CreateTable
CREATE TABLE "InstallerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installerName" TEXT NOT NULL,
    "serviceRegionsJson" TEXT NOT NULL DEFAULT '[]',
    "supportedProjectTypesJson" TEXT NOT NULL DEFAULT '[]',
    "supportedSolutionTypesJson" TEXT NOT NULL DEFAULT '[]',
    "supportedBudgetBandsJson" TEXT NOT NULL DEFAULT '[]',
    "minJobSizeSqft" REAL NOT NULL DEFAULT 0,
    "maxJobSizeSqft" REAL,
    "irrigationCapability" BOOLEAN NOT NULL DEFAULT false,
    "structuralInstallCapability" BOOLEAN NOT NULL DEFAULT false,
    "shadeSystemCapability" BOOLEAN NOT NULL DEFAULT false,
    "edibleGardenCapability" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceServiceAvailable" BOOLEAN NOT NULL DEFAULT false,
    "averageRating" REAL,
    "jobsCompletedCount" INTEGER NOT NULL DEFAULT 0,
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "activeStatus" TEXT NOT NULL DEFAULT 'active',
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InstallerQuoteRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "recommendationSessionId" TEXT,
    "selectedCandidateSnapshotId" TEXT,
    "requestStatus" TEXT NOT NULL DEFAULT 'submitted',
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userLocationRegion" TEXT NOT NULL,
    "projectSnapshotJson" TEXT NOT NULL,
    "candidateSnapshotJson" TEXT,
    "notes" TEXT,
    CONSTRAINT "InstallerQuoteRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstallerQuoteRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InstallerQuoteRequest_recommendationSessionId_fkey" FOREIGN KEY ("recommendationSessionId") REFERENCES "RecommendationTelemetrySession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InstallerQuoteRequest_selectedCandidateSnapshotId_fkey" FOREIGN KEY ("selectedCandidateSnapshotId") REFERENCES "RecommendationCandidateSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstallerQuoteAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteRequestId" TEXT NOT NULL,
    "installerId" TEXT NOT NULL,
    "assignmentStatus" TEXT NOT NULL DEFAULT 'invited',
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "declinedAt" DATETIME,
    "rejectionReasonCodesJson" TEXT,
    CONSTRAINT "InstallerQuoteAssignment_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "InstallerQuoteRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstallerQuoteAssignment_installerId_fkey" FOREIGN KEY ("installerId") REFERENCES "InstallerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstallerQuote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteRequestId" TEXT NOT NULL,
    "quoteAssignmentId" TEXT NOT NULL,
    "installerId" TEXT NOT NULL,
    "quotedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quoteStatus" TEXT NOT NULL DEFAULT 'submitted',
    "quoteAmountInr" REAL NOT NULL,
    "estimatedTimelineDays" INTEGER NOT NULL,
    "includedScopeJson" TEXT NOT NULL,
    "excludedScopeJson" TEXT,
    "proposedSpeciesJson" TEXT,
    "proposedMaterialsJson" TEXT,
    "notes" TEXT,
    "deviationFromRecommendationFlagsJson" TEXT,
    CONSTRAINT "InstallerQuote_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "InstallerQuoteRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstallerQuote_quoteAssignmentId_fkey" FOREIGN KEY ("quoteAssignmentId") REFERENCES "InstallerQuoteAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstallerQuote_installerId_fkey" FOREIGN KEY ("installerId") REFERENCES "InstallerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstallerInstallJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteRequestId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "installerId" TEXT NOT NULL,
    "sourceQuoteId" TEXT,
    "selectedCandidateSnapshotId" TEXT,
    "jobStatus" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduledDate" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "cancellationReasonCodesJson" TEXT,
    "estimatedCostInr" REAL,
    "finalCostInr" REAL,
    "installPlanJson" TEXT NOT NULL,
    "jobNotes" TEXT,
    CONSTRAINT "InstallerInstallJob_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "InstallerQuoteRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstallerInstallJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstallerInstallJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InstallerInstallJob_installerId_fkey" FOREIGN KEY ("installerId") REFERENCES "InstallerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstallerInstallJob_sourceQuoteId_fkey" FOREIGN KEY ("sourceQuoteId") REFERENCES "InstallerQuote" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InstallerInstallJob_selectedCandidateSnapshotId_fkey" FOREIGN KEY ("selectedCandidateSnapshotId") REFERENCES "RecommendationCandidateSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerifiedInstallRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installJobId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "installerId" TEXT NOT NULL,
    "verifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "installedSolutionType" TEXT NOT NULL,
    "installedAreaSqft" REAL NOT NULL,
    "installedPlanterType" TEXT NOT NULL,
    "installedIrrigationType" TEXT NOT NULL,
    "installedShadeSolution" TEXT NOT NULL,
    "installedSpeciesJson" TEXT NOT NULL,
    "installedMaterialsJson" TEXT NOT NULL,
    "installedLayoutJson" TEXT,
    "matchesRecommendedCandidate" BOOLEAN NOT NULL,
    "mismatchReasonCodesJson" TEXT NOT NULL,
    "installerConfidenceScore" REAL NOT NULL,
    "evidencePhotoRefsJson" TEXT,
    "notes" TEXT,
    CONSTRAINT "VerifiedInstallRecord_installJobId_fkey" FOREIGN KEY ("installJobId") REFERENCES "InstallerInstallJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VerifiedInstallRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VerifiedInstallRecord_installerId_fkey" FOREIGN KEY ("installerId") REFERENCES "InstallerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutcomeVerificationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "verifiedInstallId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "verifiedByType" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verificationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verificationWindowDays" INTEGER NOT NULL,
    "measuredTempChangeC" REAL,
    "measuredSurfaceTempChangeC" REAL,
    "userSatisfactionScore" REAL,
    "installerFeasibilityRating" REAL,
    "plantSurvivalRate30d" REAL,
    "plantSurvivalRate90d" REAL,
    "maintenanceAdherenceScore" REAL,
    "waterUseAssessment" REAL,
    "shadingEffectivenessScore" REAL,
    "biodiversityObservationScore" REAL,
    "verificationConfidenceTier" TEXT NOT NULL,
    "evidenceRefsJson" TEXT,
    "notes" TEXT,
    CONSTRAINT "OutcomeVerificationRecord_verifiedInstallId_fkey" FOREIGN KEY ("verifiedInstallId") REFERENCES "VerifiedInstallRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutcomeVerificationRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "InstallerProfile_activeStatus_idx" ON "InstallerProfile"("activeStatus");

-- CreateIndex
CREATE INDEX "InstallerProfile_verificationStatus_idx" ON "InstallerProfile"("verificationStatus");

-- CreateIndex
CREATE INDEX "InstallerQuoteRequest_projectId_idx" ON "InstallerQuoteRequest"("projectId");

-- CreateIndex
CREATE INDEX "InstallerQuoteRequest_requestStatus_idx" ON "InstallerQuoteRequest"("requestStatus");

-- CreateIndex
CREATE INDEX "InstallerQuoteAssignment_installerId_idx" ON "InstallerQuoteAssignment"("installerId");

-- CreateIndex
CREATE UNIQUE INDEX "InstallerQuoteAssignment_quoteRequestId_installerId_key" ON "InstallerQuoteAssignment"("quoteRequestId", "installerId");

-- CreateIndex
CREATE INDEX "InstallerQuote_quoteRequestId_idx" ON "InstallerQuote"("quoteRequestId");

-- CreateIndex
CREATE INDEX "InstallerQuote_installerId_idx" ON "InstallerQuote"("installerId");

-- CreateIndex
CREATE INDEX "InstallerQuote_quoteStatus_idx" ON "InstallerQuote"("quoteStatus");

-- CreateIndex
CREATE INDEX "InstallerInstallJob_projectId_idx" ON "InstallerInstallJob"("projectId");

-- CreateIndex
CREATE INDEX "InstallerInstallJob_installerId_idx" ON "InstallerInstallJob"("installerId");

-- CreateIndex
CREATE INDEX "InstallerInstallJob_jobStatus_idx" ON "InstallerInstallJob"("jobStatus");

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedInstallRecord_installJobId_key" ON "VerifiedInstallRecord"("installJobId");

-- CreateIndex
CREATE INDEX "VerifiedInstallRecord_projectId_idx" ON "VerifiedInstallRecord"("projectId");

-- CreateIndex
CREATE INDEX "OutcomeVerificationRecord_projectId_idx" ON "OutcomeVerificationRecord"("projectId");

-- CreateIndex
CREATE INDEX "OutcomeVerificationRecord_verifiedInstallId_idx" ON "OutcomeVerificationRecord"("verifiedInstallId");
