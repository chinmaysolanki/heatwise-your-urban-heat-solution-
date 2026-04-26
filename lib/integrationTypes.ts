export type LogIntegrationEventInput = {
  eventType: string;
  domain: string;
  sourceSystem?: string | null;
  targetSystem?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CreateOutboundSyncInput = {
  targetSystem: string;
  entityType: string;
  entityId: string;
  payloadSnapshot: Record<string, unknown>;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type OutboundSyncPreviewInput = {
  targetSystem: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
};

export type IngestWebhookInput = {
  sourceSystem: string;
  externalEventId?: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  linkageProjectId?: string | null;
  linkageUserId?: string | null;
  linkageRecommendationSessionId?: string | null;
  metadata?: Record<string, unknown> | null;
  /** When false, skip structural validation of linkage ids format. */
  strictLinkage?: boolean;
};

export type CreateDeliveryInput = {
  deliveryType: string;
  channel: string;
  targetRef: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  correlationId?: string | null;
  outboundSyncId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type UpdateDeliveryStatusInput = {
  deliveryTrackingId: string;
  deliveryStatus: string;
  lastStatusDetail?: Record<string, unknown> | null;
  incrementAttempt?: boolean;
};
