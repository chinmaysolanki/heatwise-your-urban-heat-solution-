/** Shared taxonomy for structured errors, idempotency, audit, and readiness (align with platform/hardening/schemas). */

export const ERROR_SEVERITIES = ["debug", "info", "warning", "error", "critical"] as const;
export type ErrorSeverity = (typeof ERROR_SEVERITIES)[number];

export const IDEMPOTENCY_SCOPES = [
  "telemetry_event",
  "quote_action",
  "install_submission",
  "outcome_submission",
  "revenue_event",
] as const;
export type IdempotencyScope = (typeof IDEMPOTENCY_SCOPES)[number];

/** Subsystems covered by readiness checks and audit events. */
export const PLATFORM_SUBSYSTEMS = [
  "recommendation_runtime",
  "pricing",
  "supply",
  "installer_ops",
  "reporting",
  "retraining_registry",
  "integrations",
  "analytics",
] as const;
export type PlatformSubsystem = (typeof PLATFORM_SUBSYSTEMS)[number];

export const AUDIT_ACTOR_TYPES = ["user", "system", "api_client", "ops"] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export const AUDIT_OUTCOMES = ["success", "denied", "error", "partial"] as const;

export const READINESS_STATUSES = ["pass", "fail", "degraded", "skipped", "unknown"] as const;
export type ReadinessStatus = (typeof READINESS_STATUSES)[number];

/** Stable API/service error codes (extend as needed). */
export const KNOWN_ERROR_CODES = [
  "INVALID_BODY",
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "IDEMPOTENCY_IN_FLIGHT",
  "IDEMPOTENCY_KEY_REQUIRED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "DEPENDENCY_UNAVAILABLE",
  "POLICY_DENIED",
] as const;
