import type { AuditActorType, ErrorSeverity, IdempotencyScope, PlatformSubsystem, ReadinessStatus } from "./platformHardeningConstants";

/** Extended structured error contract (superset of `StructuredError`). */
export type StructuredErrorContract = {
  code: string;
  message: string;
  severity?: ErrorSeverity;
  retriable?: boolean;
  http_status_hint?: number;
  details?: unknown;
  correlation_id?: string | null;
  subsystem?: PlatformSubsystem | string | null;
};

export type AppendAuditEventInput = {
  auditEventType: string;
  subsystem: PlatformSubsystem | string;
  actorType: AuditActorType | string;
  actorId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  action: string;
  outcome: string;
  severity?: string | null;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type IdempotencyPolicy = "required" | "optional";

export type IdempotencyRequestDescriptor = {
  scope: IdempotencyScope | string;
  idempotencyKey?: string | null;
  policy: IdempotencyPolicy;
  requestHash?: string | null;
};

export type ReadinessCheckResult = {
  check_id: string;
  subsystem: string;
  status: ReadinessStatus | string;
  latency_ms: number;
  message: string;
  details?: Record<string, unknown>;
};

export type ReadinessAggregateResponse = {
  overall: "healthy" | "degraded" | "unhealthy" | "unknown";
  generated_at: string;
  checks: ReadinessCheckResult[];
};
