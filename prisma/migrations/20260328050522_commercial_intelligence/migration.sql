-- CreateTable
CREATE TABLE "RevenueEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "eventTimestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "projectId" TEXT,
    "recommendationSessionId" TEXT,
    "quoteRequestId" TEXT,
    "installerQuoteId" TEXT,
    "installJobId" TEXT,
    "installerId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "grossAmount" REAL,
    "netAmount" REAL,
    "commissionAmount" REAL,
    "platformFeeAmount" REAL,
    "discountAmount" REAL,
    "refundAmount" REAL,
    "taxAmount" REAL,
    "revenueStatus" TEXT NOT NULL,
    "paymentStatus" TEXT,
    "revenueSource" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RevenueEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RevenueEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RevenueEvent_recommendationSessionId_fkey" FOREIGN KEY ("recommendationSessionId") REFERENCES "RecommendationTelemetrySession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RevenueEvent_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "InstallerQuoteRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RevenueEvent_installerQuoteId_fkey" FOREIGN KEY ("installerQuoteId") REFERENCES "InstallerQuote" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RevenueEvent_installJobId_fkey" FOREIGN KEY ("installJobId") REFERENCES "InstallerInstallJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RevenueEvent_installerId_fkey" FOREIGN KEY ("installerId") REFERENCES "InstallerProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeadFunnelEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "eventTimestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "projectId" TEXT NOT NULL,
    "recommendationSessionId" TEXT,
    "quoteRequestId" TEXT,
    "installerQuoteId" TEXT,
    "installJobId" TEXT,
    "installerId" TEXT,
    "funnelStage" TEXT NOT NULL,
    "sourceChannel" TEXT,
    "campaignId" TEXT,
    "region" TEXT,
    "projectType" TEXT,
    "budgetBand" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadFunnelEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LeadFunnelEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeadFunnelEvent_recommendationSessionId_fkey" FOREIGN KEY ("recommendationSessionId") REFERENCES "RecommendationTelemetrySession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LeadFunnelEvent_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "InstallerQuoteRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LeadFunnelEvent_installerQuoteId_fkey" FOREIGN KEY ("installerQuoteId") REFERENCES "InstallerQuote" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LeadFunnelEvent_installJobId_fkey" FOREIGN KEY ("installJobId") REFERENCES "InstallerInstallJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LeadFunnelEvent_installerId_fkey" FOREIGN KEY ("installerId") REFERENCES "InstallerProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommercialOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "installerId" TEXT,
    "region" TEXT,
    "projectType" TEXT,
    "firstRecommendationAt" DATETIME,
    "firstQuoteRequestedAt" DATETIME,
    "firstQuoteReceivedAt" DATETIME,
    "quoteAcceptedAt" DATETIME,
    "installCompletedAt" DATETIME,
    "timeToQuoteHours" REAL,
    "timeToInstallDays" REAL,
    "quotesReceivedCount" INTEGER NOT NULL DEFAULT 0,
    "quoteAcceptanceRate" REAL,
    "grossRevenueInr" REAL,
    "netRevenueInr" REAL,
    "platformMarginInr" REAL,
    "totalDiscountInr" REAL,
    "refundTotalInr" REAL,
    "customerLtvInr" REAL,
    "installerRevenueInr" REAL,
    "commercialStatus" TEXT NOT NULL,
    "metadataJson" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CommercialOutcome_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UnitEconomicsSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "windowStart" DATETIME NOT NULL,
    "windowEnd" DATETIME NOT NULL,
    "region" TEXT,
    "projectType" TEXT,
    "sourceChannel" TEXT,
    "totalProjects" INTEGER NOT NULL,
    "totalQuoteRequests" INTEGER NOT NULL,
    "totalQuotesReceived" INTEGER NOT NULL,
    "totalQuoteAcceptances" INTEGER NOT NULL,
    "totalInstallsCompleted" INTEGER NOT NULL,
    "quoteRequestToQuoteReceivedRate" REAL,
    "quoteReceivedToAcceptanceRate" REAL,
    "acceptanceToInstallRate" REAL,
    "installConversionRate" REAL,
    "avgRevenuePerProjectInr" REAL,
    "avgRevenuePerInstallInr" REAL,
    "avgPlatformMarginInr" REAL,
    "avgQuoteValueInr" REAL,
    "avgFinalInstallValueInr" REAL,
    "avgTimeToQuoteHours" REAL,
    "avgTimeToInstallDays" REAL,
    "refundRate" REAL,
    "repeatServiceRate" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" TEXT
);

-- CreateTable
CREATE TABLE "InstallerCommercialMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installerId" TEXT NOT NULL,
    "windowStart" DATETIME NOT NULL,
    "windowEnd" DATETIME NOT NULL,
    "region" TEXT,
    "quotesSubmitted" INTEGER NOT NULL,
    "quotesAccepted" INTEGER NOT NULL,
    "installsCompleted" INTEGER NOT NULL,
    "quoteAcceptanceRate" REAL,
    "installCompletionRate" REAL,
    "avgQuoteAmountInr" REAL,
    "avgFinalInstallAmountInr" REAL,
    "avgQuoteToFinalDeltaPct" REAL,
    "totalInstallerRevenueInr" REAL,
    "totalPlatformCommissionInr" REAL,
    "cancellationRate" REAL,
    "refundRate" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" TEXT,
    CONSTRAINT "InstallerCommercialMetrics_installerId_fkey" FOREIGN KEY ("installerId") REFERENCES "InstallerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RevenueEvent_eventTimestamp_idx" ON "RevenueEvent"("eventTimestamp");

-- CreateIndex
CREATE INDEX "RevenueEvent_eventType_idx" ON "RevenueEvent"("eventType");

-- CreateIndex
CREATE INDEX "RevenueEvent_projectId_idx" ON "RevenueEvent"("projectId");

-- CreateIndex
CREATE INDEX "RevenueEvent_installerId_idx" ON "RevenueEvent"("installerId");

-- CreateIndex
CREATE INDEX "LeadFunnelEvent_projectId_eventTimestamp_idx" ON "LeadFunnelEvent"("projectId", "eventTimestamp");

-- CreateIndex
CREATE INDEX "LeadFunnelEvent_funnelStage_idx" ON "LeadFunnelEvent"("funnelStage");

-- CreateIndex
CREATE INDEX "LeadFunnelEvent_eventTimestamp_idx" ON "LeadFunnelEvent"("eventTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialOutcome_projectId_key" ON "CommercialOutcome"("projectId");

-- CreateIndex
CREATE INDEX "CommercialOutcome_commercialStatus_idx" ON "CommercialOutcome"("commercialStatus");

-- CreateIndex
CREATE INDEX "CommercialOutcome_installerId_idx" ON "CommercialOutcome"("installerId");

-- CreateIndex
CREATE INDEX "UnitEconomicsSnapshot_windowStart_windowEnd_idx" ON "UnitEconomicsSnapshot"("windowStart", "windowEnd");

-- CreateIndex
CREATE INDEX "UnitEconomicsSnapshot_region_idx" ON "UnitEconomicsSnapshot"("region");

-- CreateIndex
CREATE INDEX "InstallerCommercialMetrics_installerId_windowStart_windowEnd_idx" ON "InstallerCommercialMetrics"("installerId", "windowStart", "windowEnd");
