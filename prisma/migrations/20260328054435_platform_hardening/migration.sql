-- CreateTable
CREATE TABLE "PlatformAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditEventType" TEXT NOT NULL,
    "subsystem" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "payloadJson" TEXT NOT NULL,
    "correlationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" TEXT
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'in_flight',
    "httpStatus" INTEGER,
    "responseBodyJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "PlatformAuditEvent_subsystem_createdAt_idx" ON "PlatformAuditEvent"("subsystem", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformAuditEvent_auditEventType_idx" ON "PlatformAuditEvent"("auditEventType");

-- CreateIndex
CREATE INDEX "PlatformAuditEvent_entityType_entityId_idx" ON "PlatformAuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "PlatformAuditEvent_correlationId_idx" ON "PlatformAuditEvent"("correlationId");

-- CreateIndex
CREATE INDEX "PlatformAuditEvent_actorType_actorId_idx" ON "PlatformAuditEvent"("actorType", "actorId");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_scope_createdAt_idx" ON "IdempotencyRecord"("scope", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_status_idx" ON "IdempotencyRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_scope_idempotencyKey_key" ON "IdempotencyRecord"("scope", "idempotencyKey");
