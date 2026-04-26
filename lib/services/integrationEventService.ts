import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import { INTEGRATION_DOMAINS, KNOWN_SYSTEMS } from "@/lib/integrationConstants";
import type { LogIntegrationEventInput } from "@/lib/integrationTypes";

function isDomain(x: string): boolean {
  return (INTEGRATION_DOMAINS as readonly string[]).includes(x);
}

function isKnownSystem(x: string | null | undefined): boolean {
  if (!x) return true;
  return (KNOWN_SYSTEMS as readonly string[]).includes(x);
}

/**
 * Append-only integration audit log.
 */
export async function logIntegrationEvent(
  input: LogIntegrationEventInput,
): Promise<{ ok: true; integrationEventId: string } | { ok: false; error: StructuredError }> {
  if (!String(input.eventType || "").trim()) {
    return { ok: false, error: validationError("INVALID_BODY", "eventType required") };
  }
  if (!isDomain(input.domain)) {
    return { ok: false, error: validationError("INVALID_DOMAIN", "unknown integration domain") };
  }
  if (!isKnownSystem(input.sourceSystem)) {
    return { ok: false, error: validationError("INVALID_SOURCE_SYSTEM", "sourceSystem not in known allowlist") };
  }
  if (!isKnownSystem(input.targetSystem)) {
    return { ok: false, error: validationError("INVALID_TARGET_SYSTEM", "targetSystem not in known allowlist") };
  }

  const row = await db.integrationEvent.create({
    data: {
      eventType: input.eventType.trim(),
      domain: input.domain,
      sourceSystem: input.sourceSystem?.trim() || undefined,
      targetSystem: input.targetSystem?.trim() || undefined,
      entityType: input.entityType?.trim() || undefined,
      entityId: input.entityId?.trim() || undefined,
      payloadJson: JSON.stringify(input.payload ?? {}),
      correlationId: input.correlationId?.trim() || undefined,
      metadataJson: input.metadata && Object.keys(input.metadata).length > 0 ? JSON.stringify(input.metadata) : undefined,
    },
  });

  return { ok: true, integrationEventId: row.id };
}
