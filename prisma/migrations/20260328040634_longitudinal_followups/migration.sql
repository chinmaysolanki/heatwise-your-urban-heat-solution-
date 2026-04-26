-- CreateTable
CREATE TABLE "LongitudinalFollowupSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "verifiedInstallId" TEXT,
    "baselineAt" DATETIME NOT NULL,
    "scheduleStatus" TEXT NOT NULL DEFAULT 'active',
    "offsetsIncludedJson" TEXT NOT NULL DEFAULT '[7,30,90,180]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LongitudinalFollowupSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LongitudinalFollowupSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LongitudinalFollowupSchedule_verifiedInstallId_fkey" FOREIGN KEY ("verifiedInstallId") REFERENCES "VerifiedInstallRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LongitudinalFollowupCheckpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "offsetDays" INTEGER NOT NULL,
    "windowLabel" TEXT NOT NULL,
    "dueAt" DATETIME NOT NULL,
    "checkpointStatus" TEXT NOT NULL DEFAULT 'pending',
    "rescheduledDueAt" DATETIME,
    "completedAt" DATETIME,
    "lastNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LongitudinalFollowupCheckpoint_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "LongitudinalFollowupSchedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LongitudinalFollowupEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkpointId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" TEXT,
    "qualitativeNote" TEXT,
    CONSTRAINT "LongitudinalFollowupEvent_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "LongitudinalFollowupCheckpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LongitudinalRemeasurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "checkpointId" TEXT,
    "measuredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowLabel" TEXT NOT NULL,
    "plantSurvivalRate" REAL,
    "surfaceTempDeltaC" REAL,
    "userSatisfactionScore" REAL,
    "maintenanceAdherenceScore" REAL,
    "heatMitigationStabilityScore" REAL,
    "qualitativeNotes" TEXT,
    "evidenceRefsJson" TEXT,
    "ambientContextJson" TEXT,
    CONSTRAINT "LongitudinalRemeasurement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LongitudinalRemeasurement_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "LongitudinalFollowupSchedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LongitudinalRemeasurement_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "LongitudinalFollowupCheckpoint" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LongitudinalFollowupSchedule_projectId_idx" ON "LongitudinalFollowupSchedule"("projectId");

-- CreateIndex
CREATE INDEX "LongitudinalFollowupSchedule_baselineAt_idx" ON "LongitudinalFollowupSchedule"("baselineAt");

-- CreateIndex
CREATE INDEX "LongitudinalFollowupSchedule_scheduleStatus_idx" ON "LongitudinalFollowupSchedule"("scheduleStatus");

-- CreateIndex
CREATE INDEX "LongitudinalFollowupCheckpoint_dueAt_idx" ON "LongitudinalFollowupCheckpoint"("dueAt");

-- CreateIndex
CREATE INDEX "LongitudinalFollowupCheckpoint_checkpointStatus_idx" ON "LongitudinalFollowupCheckpoint"("checkpointStatus");

-- CreateIndex
CREATE UNIQUE INDEX "LongitudinalFollowupCheckpoint_scheduleId_offsetDays_key" ON "LongitudinalFollowupCheckpoint"("scheduleId", "offsetDays");

-- CreateIndex
CREATE INDEX "LongitudinalFollowupEvent_checkpointId_idx" ON "LongitudinalFollowupEvent"("checkpointId");

-- CreateIndex
CREATE INDEX "LongitudinalFollowupEvent_eventType_idx" ON "LongitudinalFollowupEvent"("eventType");

-- CreateIndex
CREATE INDEX "LongitudinalFollowupEvent_eventAt_idx" ON "LongitudinalFollowupEvent"("eventAt");

-- CreateIndex
CREATE INDEX "LongitudinalRemeasurement_projectId_idx" ON "LongitudinalRemeasurement"("projectId");

-- CreateIndex
CREATE INDEX "LongitudinalRemeasurement_measuredAt_idx" ON "LongitudinalRemeasurement"("measuredAt");

-- CreateIndex
CREATE INDEX "LongitudinalRemeasurement_checkpointId_idx" ON "LongitudinalRemeasurement"("checkpointId");

-- CreateIndex
CREATE INDEX "LongitudinalRemeasurement_scheduleId_idx" ON "LongitudinalRemeasurement"("scheduleId");
