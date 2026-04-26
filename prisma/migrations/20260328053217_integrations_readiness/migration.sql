-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "sourceSystem" TEXT,
    "targetSystem" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "payloadJson" TEXT NOT NULL,
    "correlationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" TEXT
);

-- CreateTable
CREATE TABLE "OutboundSync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetSystem" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payloadSnapshotJson" TEXT NOT NULL,
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME,
    "nextRetryAt" DATETIME,
    "errorCode" TEXT,
    "errorDetailJson" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "metadataJson" TEXT
);

-- CreateTable
CREATE TABLE "InboundWebhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceSystem" TEXT NOT NULL,
    "externalEventId" TEXT,
    "eventType" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "validationStatus" TEXT NOT NULL DEFAULT 'received',
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "linkageProjectId" TEXT,
    "linkageUserId" TEXT,
    "linkageRecommendationSessionId" TEXT,
    "duplicateOfWebhookId" TEXT,
    "metadataJson" TEXT
);

-- CreateTable
CREATE TABLE "DeliveryTracking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "targetRef" TEXT NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'queued',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME,
    "lastStatusDetailJson" TEXT,
    "correlationId" TEXT,
    "outboundSyncId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "metadataJson" TEXT
);

-- CreateIndex
CREATE INDEX "IntegrationEvent_domain_createdAt_idx" ON "IntegrationEvent"("domain", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationEvent_eventType_idx" ON "IntegrationEvent"("eventType");

-- CreateIndex
CREATE INDEX "IntegrationEvent_correlationId_idx" ON "IntegrationEvent"("correlationId");

-- CreateIndex
CREATE INDEX "IntegrationEvent_entityType_entityId_idx" ON "IntegrationEvent"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundSync_idempotencyKey_key" ON "OutboundSync"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OutboundSync_targetSystem_syncStatus_idx" ON "OutboundSync"("targetSystem", "syncStatus");

-- CreateIndex
CREATE INDEX "OutboundSync_entityType_entityId_idx" ON "OutboundSync"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "OutboundSync_nextRetryAt_idx" ON "OutboundSync"("nextRetryAt");

-- CreateIndex
CREATE INDEX "InboundWebhook_sourceSystem_receivedAt_idx" ON "InboundWebhook"("sourceSystem", "receivedAt");

-- CreateIndex
CREATE INDEX "InboundWebhook_validationStatus_idx" ON "InboundWebhook"("validationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "InboundWebhook_sourceSystem_externalEventId_key" ON "InboundWebhook"("sourceSystem", "externalEventId");

-- CreateIndex
CREATE INDEX "DeliveryTracking_deliveryType_deliveryStatus_idx" ON "DeliveryTracking"("deliveryType", "deliveryStatus");

-- CreateIndex
CREATE INDEX "DeliveryTracking_correlationId_idx" ON "DeliveryTracking"("correlationId");

-- CreateIndex
CREATE INDEX "DeliveryTracking_outboundSyncId_idx" ON "DeliveryTracking"("outboundSyncId");
