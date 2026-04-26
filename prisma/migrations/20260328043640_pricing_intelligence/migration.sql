-- CreateTable
CREATE TABLE "CostEstimateSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "recommendationSessionId" TEXT,
    "candidateSnapshotId" TEXT,
    "estimateGeneratedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pricingModelVersion" TEXT,
    "pricingRulesVersion" TEXT,
    "region" TEXT NOT NULL,
    "climateZone" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "solutionType" TEXT NOT NULL,
    "estimateSource" TEXT NOT NULL,
    "estimatedInstallCostMinInr" REAL NOT NULL,
    "estimatedInstallCostMedianInr" REAL NOT NULL,
    "estimatedInstallCostMaxInr" REAL NOT NULL,
    "estimatedAnnualMaintenanceMinInr" REAL NOT NULL,
    "estimatedAnnualMaintenanceMedianInr" REAL NOT NULL,
    "estimatedAnnualMaintenanceMaxInr" REAL NOT NULL,
    "materialCostComponentInr" REAL,
    "laborCostComponentInr" REAL,
    "irrigationCostComponentInr" REAL,
    "shadeSystemCostComponentInr" REAL,
    "logisticsCostComponentInr" REAL,
    "contingencyPct" REAL,
    "estimateConfidenceBand" TEXT NOT NULL,
    "quoteVolatilityScore" REAL NOT NULL,
    "budgetFitScore" REAL,
    "notes" TEXT,
    "metadataJson" TEXT,
    "majorCostDriversJson" TEXT,
    "uncertaintyReasonsJson" TEXT,
    "cheaperAlternativesJson" TEXT,
    "phasedInstallOptionJson" TEXT,
    CONSTRAINT "CostEstimateSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CostEstimateSnapshot_recommendationSessionId_fkey" FOREIGN KEY ("recommendationSessionId") REFERENCES "RecommendationTelemetrySession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CostEstimateSnapshot_candidateSnapshotId_fkey" FOREIGN KEY ("candidateSnapshotId") REFERENCES "RecommendationCandidateSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteComparisonRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "recommendationSessionId" TEXT,
    "candidateSnapshotId" TEXT,
    "installerQuoteId" TEXT,
    "installJobId" TEXT,
    "costEstimateId" TEXT,
    "comparisonGeneratedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "predictedInstallCostMedianInr" REAL,
    "quotedInstallCostInr" REAL,
    "finalInstallCostInr" REAL,
    "installCostErrorAbsInr" REAL,
    "installCostErrorPct" REAL,
    "quoteToFinalDeltaInr" REAL,
    "quoteToFinalDeltaPct" REAL,
    "maintenancePredictionErrorAbsInr" REAL,
    "maintenancePredictionErrorPct" REAL,
    "pricingAccuracyBand" TEXT,
    "costRiskFlagsJson" TEXT,
    "notes" TEXT,
    CONSTRAINT "QuoteComparisonRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteComparisonRecord_recommendationSessionId_fkey" FOREIGN KEY ("recommendationSessionId") REFERENCES "RecommendationTelemetrySession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuoteComparisonRecord_candidateSnapshotId_fkey" FOREIGN KEY ("candidateSnapshotId") REFERENCES "RecommendationCandidateSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuoteComparisonRecord_installerQuoteId_fkey" FOREIGN KEY ("installerQuoteId") REFERENCES "InstallerQuote" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuoteComparisonRecord_installJobId_fkey" FOREIGN KEY ("installJobId") REFERENCES "InstallerInstallJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuoteComparisonRecord_costEstimateId_fkey" FOREIGN KEY ("costEstimateId") REFERENCES "CostEstimateSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetFitAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "candidateSnapshotId" TEXT,
    "userBudgetInr" REAL NOT NULL,
    "estimatedInstallCostMedianInr" REAL NOT NULL,
    "estimatedInstallCostMaxInr" REAL NOT NULL,
    "budgetFitBand" TEXT NOT NULL,
    "budgetFitScore" REAL NOT NULL,
    "stretchBudgetRequired" BOOLEAN NOT NULL,
    "affordabilityRiskLevel" TEXT NOT NULL,
    "downgradeSuggestionJson" TEXT,
    "budgetFitReason" TEXT,
    "cheaperAlternativesJson" TEXT,
    "phasedInstallOptionJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetFitAssessment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BudgetFitAssessment_candidateSnapshotId_fkey" FOREIGN KEY ("candidateSnapshotId") REFERENCES "RecommendationCandidateSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CostEstimateSnapshot_projectId_idx" ON "CostEstimateSnapshot"("projectId");

-- CreateIndex
CREATE INDEX "CostEstimateSnapshot_recommendationSessionId_idx" ON "CostEstimateSnapshot"("recommendationSessionId");

-- CreateIndex
CREATE INDEX "CostEstimateSnapshot_candidateSnapshotId_idx" ON "CostEstimateSnapshot"("candidateSnapshotId");

-- CreateIndex
CREATE INDEX "CostEstimateSnapshot_estimateGeneratedAt_idx" ON "CostEstimateSnapshot"("estimateGeneratedAt");

-- CreateIndex
CREATE INDEX "QuoteComparisonRecord_projectId_idx" ON "QuoteComparisonRecord"("projectId");

-- CreateIndex
CREATE INDEX "QuoteComparisonRecord_installerQuoteId_idx" ON "QuoteComparisonRecord"("installerQuoteId");

-- CreateIndex
CREATE INDEX "QuoteComparisonRecord_installJobId_idx" ON "QuoteComparisonRecord"("installJobId");

-- CreateIndex
CREATE INDEX "QuoteComparisonRecord_costEstimateId_idx" ON "QuoteComparisonRecord"("costEstimateId");

-- CreateIndex
CREATE INDEX "QuoteComparisonRecord_comparisonGeneratedAt_idx" ON "QuoteComparisonRecord"("comparisonGeneratedAt");

-- CreateIndex
CREATE INDEX "BudgetFitAssessment_projectId_idx" ON "BudgetFitAssessment"("projectId");

-- CreateIndex
CREATE INDEX "BudgetFitAssessment_candidateSnapshotId_idx" ON "BudgetFitAssessment"("candidateSnapshotId");

-- CreateIndex
CREATE INDEX "BudgetFitAssessment_createdAt_idx" ON "BudgetFitAssessment"("createdAt");
