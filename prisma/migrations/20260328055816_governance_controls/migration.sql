-- CreateTable
CREATE TABLE "UserConsentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "consentScope" TEXT NOT NULL,
    "consentStatus" TEXT NOT NULL DEFAULT 'granted',
    "sourceChannel" TEXT,
    "grantedAt" DATETIME,
    "withdrawnAt" DATETIME,
    "expiresAt" DATETIME,
    "legalBasis" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GovernancePolicyFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "flagType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "entityType" TEXT,
    "entityId" TEXT,
    "userId" TEXT,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "detailJson" TEXT,
    "raisedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "metadataJson" TEXT,
    CONSTRAINT "GovernancePolicyFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GovernancePolicyFlag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataRetentionCategoryPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityCategory" TEXT NOT NULL,
    "defaultRetentionDays" INTEGER NOT NULL,
    "archiveAfterDays" INTEGER,
    "hardDeleteAfterDays" INTEGER,
    "notesJson" TEXT,
    "policyVersion" TEXT NOT NULL DEFAULT 'v1',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GovernanceReviewRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "subjectEntityType" TEXT NOT NULL,
    "subjectEntityId" TEXT NOT NULL,
    "relatedUserId" TEXT,
    "relatedProjectId" TEXT,
    "openedByActorId" TEXT,
    "openedByActorType" TEXT,
    "findingsJson" TEXT,
    "resolutionSummary" TEXT,
    "assignedToActorId" TEXT,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "metadataJson" TEXT,
    CONSTRAINT "GovernanceReviewRecord_relatedUserId_fkey" FOREIGN KEY ("relatedUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GovernanceReviewRecord_relatedProjectId_fkey" FOREIGN KEY ("relatedProjectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserConsentRecord_consentScope_consentStatus_idx" ON "UserConsentRecord"("consentScope", "consentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "UserConsentRecord_userId_consentScope_key" ON "UserConsentRecord"("userId", "consentScope");

-- CreateIndex
CREATE INDEX "GovernancePolicyFlag_status_severity_idx" ON "GovernancePolicyFlag"("status", "severity");

-- CreateIndex
CREATE INDEX "GovernancePolicyFlag_flagType_idx" ON "GovernancePolicyFlag"("flagType");

-- CreateIndex
CREATE INDEX "GovernancePolicyFlag_entityType_entityId_idx" ON "GovernancePolicyFlag"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "DataRetentionCategoryPolicy_entityCategory_key" ON "DataRetentionCategoryPolicy"("entityCategory");

-- CreateIndex
CREATE INDEX "DataRetentionCategoryPolicy_entityCategory_idx" ON "DataRetentionCategoryPolicy"("entityCategory");

-- CreateIndex
CREATE INDEX "GovernanceReviewRecord_status_priority_idx" ON "GovernanceReviewRecord"("status", "priority");

-- CreateIndex
CREATE INDEX "GovernanceReviewRecord_subjectEntityType_subjectEntityId_idx" ON "GovernanceReviewRecord"("subjectEntityType", "subjectEntityId");

-- CreateIndex
CREATE INDEX "GovernanceReviewRecord_openedAt_idx" ON "GovernanceReviewRecord"("openedAt");
