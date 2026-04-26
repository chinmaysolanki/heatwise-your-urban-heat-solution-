-- CreateTable
CREATE TABLE "PartnerOperationsProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installerId" TEXT NOT NULL,
    "organizationName" TEXT,
    "legalEntityName" TEXT,
    "serviceAreasJson" TEXT NOT NULL DEFAULT '[]',
    "complianceStatus" TEXT NOT NULL DEFAULT 'pending',
    "partnerActiveStatus" TEXT NOT NULL DEFAULT 'operational',
    "primaryContactJson" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartnerOperationsProfile_installerId_fkey" FOREIGN KEY ("installerId") REFERENCES "InstallerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartnerCapabilityMatrix" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installerId" TEXT NOT NULL,
    "projectTypesJson" TEXT NOT NULL DEFAULT '[]',
    "solutionTypesJson" TEXT NOT NULL DEFAULT '[]',
    "complexityBandsJson" TEXT NOT NULL DEFAULT '[]',
    "seasonalConstraintsJson" TEXT NOT NULL DEFAULT '{}',
    "serviceReadiness" TEXT NOT NULL DEFAULT 'ready',
    "matrixExtrasJson" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartnerCapabilityMatrix_installerId_fkey" FOREIGN KEY ("installerId") REFERENCES "InstallerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartnerFieldOpsStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installerId" TEXT NOT NULL,
    "availabilityState" TEXT NOT NULL DEFAULT 'available',
    "pauseState" TEXT,
    "overloadSignal" TEXT NOT NULL DEFAULT 'none',
    "coverageGapsJson" TEXT,
    "regionalReadinessJson" TEXT NOT NULL DEFAULT '{}',
    "signalNotesJson" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartnerFieldOpsStatus_installerId_fkey" FOREIGN KEY ("installerId") REFERENCES "InstallerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartnerSLAMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installerId" TEXT NOT NULL,
    "windowStart" DATETIME NOT NULL,
    "windowEnd" DATETIME NOT NULL,
    "responseTimeMsP50" INTEGER,
    "quoteTurnaroundHoursP50" REAL,
    "siteVisitCompletionRate" REAL,
    "installStartDelayDaysP50" REAL,
    "verificationDelayDaysP50" REAL,
    "jobSampleSize" INTEGER NOT NULL DEFAULT 0,
    "metadataJson" TEXT,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartnerSLAMetrics_installerId_fkey" FOREIGN KEY ("installerId") REFERENCES "InstallerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerOperationsProfile_installerId_key" ON "PartnerOperationsProfile"("installerId");

-- CreateIndex
CREATE INDEX "PartnerOperationsProfile_complianceStatus_idx" ON "PartnerOperationsProfile"("complianceStatus");

-- CreateIndex
CREATE INDEX "PartnerOperationsProfile_partnerActiveStatus_idx" ON "PartnerOperationsProfile"("partnerActiveStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCapabilityMatrix_installerId_key" ON "PartnerCapabilityMatrix"("installerId");

-- CreateIndex
CREATE INDEX "PartnerCapabilityMatrix_serviceReadiness_idx" ON "PartnerCapabilityMatrix"("serviceReadiness");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerFieldOpsStatus_installerId_key" ON "PartnerFieldOpsStatus"("installerId");

-- CreateIndex
CREATE INDEX "PartnerFieldOpsStatus_availabilityState_idx" ON "PartnerFieldOpsStatus"("availabilityState");

-- CreateIndex
CREATE INDEX "PartnerSLAMetrics_installerId_computedAt_idx" ON "PartnerSLAMetrics"("installerId", "computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSLAMetrics_installerId_windowStart_windowEnd_key" ON "PartnerSLAMetrics"("installerId", "windowStart", "windowEnd");
