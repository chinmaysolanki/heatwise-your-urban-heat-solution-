import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import { KNOWN_SYSTEMS } from "@/lib/integrationConstants";
import type { IngestWebhookInput } from "@/lib/integrationTypes";

const CUID_LIKE = /^c[a-z0-9]{24,}$/i;

function isKnownSource(x: string): boolean {
  return (KNOWN_SYSTEMS as readonly string[]).includes(x.trim());
}

/**
 * Inbound webhook envelope: append-only row + duplicate protection when externalEventId is set.
 * Dedup by (sourceSystem, externalEventId) is enforced at DB; callers should always send stable external ids from partners.
 */
export async function ingestInboundWebhook(
  input: IngestWebhookInput,
): Promise<
  | { ok: true; inboundWebhookId: string; duplicate: false; validationStatus: string }
  | { ok: true; inboundWebhookId: string; duplicate: true }
  | { ok: false; error: StructuredError }
> {
  const sourceSystem = String(input.sourceSystem || "").trim();
  const eventType = String(input.eventType || "").trim();

  if (!sourceSystem || !isKnownSource(sourceSystem)) {
    return { ok: false, error: validationError("INVALID_SOURCE_SYSTEM", "sourceSystem unknown or missing") };
  }
  if (!eventType) {
    return { ok: false, error: validationError("INVALID_BODY", "eventType required") };
  }
  if (input.payload == null || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    return { ok: false, error: validationError("INVALID_PAYLOAD", "payload must be a JSON object") };
  }

  const strict = input.strictLinkage !== false;
  const refs: Array<{ field: string; id: string | null | undefined }> = [
    { field: "linkageProjectId", id: input.linkageProjectId },
    { field: "linkageUserId", id: input.linkageUserId },
    { field: "linkageRecommendationSessionId", id: input.linkageRecommendationSessionId },
  ];
  for (const { field, id } of refs) {
    if (id == null || id === "") continue;
    if (typeof id !== "string" || !CUID_LIKE.test(id)) {
      return {
        ok: false,
        error: validationError("INVALID_ENTITY_REFERENCE", `${field} must be a cuid-like id when provided`),
      };
    }
  }

  if (strict && input.linkageProjectId) {
    const proj = await db.project.findUnique({
      where: { id: String(input.linkageProjectId).trim() },
      select: { id: true },
    });
    if (!proj) {
      return { ok: false, error: validationError("BROKEN_ENTITY_REFERENCE", "linkageProjectId not found") };
    }
  }

  const externalEventId = input.externalEventId?.trim() || null;

  if (externalEventId) {
    const existing = await db.inboundWebhook.findUnique({
      where: {
        sourceSystem_externalEventId: { sourceSystem, externalEventId },
      },
    });
    if (existing) {
      return { ok: true, inboundWebhookId: existing.id, duplicate: true };
    }
  }

  let validationStatus = "received";
  try {
    JSON.stringify(input.payload);
  } catch {
    return { ok: false, error: validationError("INVALID_PAYLOAD", "payload is not JSON-serializable") };
  }

  const row = await db.inboundWebhook.create({
    data: {
      sourceSystem,
      externalEventId: externalEventId ?? undefined,
      eventType,
      payloadJson: JSON.stringify(input.payload),
      validationStatus,
      linkageProjectId: input.linkageProjectId?.trim() || undefined,
      linkageUserId: input.linkageUserId?.trim() || undefined,
      linkageRecommendationSessionId: input.linkageRecommendationSessionId?.trim() || undefined,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });

  return { ok: true, inboundWebhookId: row.id, duplicate: false, validationStatus: row.validationStatus };
}

export async function markWebhookValidation(
  inboundWebhookId: string,
  patch: { validationStatus: string; processed?: boolean },
): Promise<{ ok: true } | { ok: false; error: StructuredError }> {
  const allowed = ["received", "valid", "invalid", "rejected", "duplicate"];
  if (!allowed.includes(patch.validationStatus)) {
    return { ok: false, error: validationError("INVALID_VALIDATION_STATUS", "unknown validation status") };
  }
  await db.inboundWebhook.update({
    where: { id: inboundWebhookId },
    data: {
      validationStatus: patch.validationStatus,
      processedAt: patch.processed ? new Date() : undefined,
    },
  });
  return { ok: true };
}
