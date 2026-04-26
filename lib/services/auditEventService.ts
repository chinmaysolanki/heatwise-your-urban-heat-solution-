import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import { AUDIT_ACTOR_TYPES, AUDIT_OUTCOMES, PLATFORM_SUBSYSTEMS } from "@/lib/platformHardeningConstants";
import type { AppendAuditEventInput } from "@/lib/platformHardeningTypes";

const CUID_LIKE = /^c[a-z0-9]{24,}$/i;

function inList<T extends string>(v: string, list: readonly T[]): v is T {
  return (list as readonly string[]).includes(v);
}

/**
 * Append-only audit row for sensitive flows (no updates).
 */
export async function appendPlatformAuditEvent(
  input: AppendAuditEventInput,
): Promise<{ ok: true; platformAuditEventId: string } | { ok: false; error: StructuredError }> {
  const subsystem = String(input.subsystem || "").trim();
  if (!subsystem || !inList(subsystem, PLATFORM_SUBSYSTEMS)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid audit subsystem") };
  }

  const actorType = String(input.actorType || "").trim();
  if (!actorType || !inList(actorType, AUDIT_ACTOR_TYPES)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid actor_type") };
  }

  const outcome = String(input.outcome || "").trim();
  if (!outcome || !inList(outcome, AUDIT_OUTCOMES)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid outcome") };
  }

  if (!String(input.action || "").trim() || !String(input.auditEventType || "").trim()) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "auditEventType and action required") };
  }

  if (input.payload == null || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "payload must be an object") };
  }

  for (const [label, id] of [
    ["actorId", input.actorId],
    ["entityId", input.entityId],
  ] as const) {
    if (id == null || id === "") continue;
    if (typeof id !== "string" || !CUID_LIKE.test(id.trim())) {
      return { ok: false, error: validationError("VALIDATION_FAILED", `${label} must be cuid-like when set`) };
    }
  }

  const row = await db.platformAuditEvent.create({
    data: {
      auditEventType: input.auditEventType.trim(),
      subsystem,
      actorType,
      actorId: input.actorId?.trim() || undefined,
      entityType: input.entityType?.trim() || undefined,
      entityId: input.entityId?.trim() || undefined,
      action: input.action.trim(),
      outcome,
      severity: input.severity?.trim() || "info",
      payloadJson: JSON.stringify(input.payload),
      correlationId: input.correlationId?.trim() || undefined,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });

  return { ok: true, platformAuditEventId: row.id };
}

export async function listRecentPlatformAuditEvents(limit: number): Promise<
  Array<{
    id: string;
    auditEventType: string;
    subsystem: string;
    outcome: string;
    createdAt: Date;
  }>
> {
  const cap = Math.min(Math.max(limit || 20, 1), 200);
  return db.platformAuditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: cap,
    select: {
      id: true,
      auditEventType: true,
      subsystem: true,
      outcome: true,
      createdAt: true,
    },
  });
}
