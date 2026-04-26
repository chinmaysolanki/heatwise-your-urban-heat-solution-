import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import { KNOWN_SYSTEMS, SYNC_STATUSES } from "@/lib/integrationConstants";
import type { CreateOutboundSyncInput, OutboundSyncPreviewInput } from "@/lib/integrationTypes";

function isKnownTarget(x: string): boolean {
  return (KNOWN_SYSTEMS as readonly string[]).includes(x);
}

function isSyncStatus(x: string): boolean {
  return (SYNC_STATUSES as readonly string[]).includes(x);
}

/**
 * Read-only preview of outbound payload (size, hash placeholder, normalized keys) — no DB write.
 */
export function previewOutboundSync(input: OutboundSyncPreviewInput): { ok: true; preview: Record<string, unknown> } | { ok: false; error: StructuredError } {
  if (!String(input.targetSystem || "").trim() || !isKnownTarget(input.targetSystem.trim())) {
    return { ok: false, error: validationError("INVALID_TARGET_SYSTEM", "targetSystem unknown") };
  }
  if (!String(input.entityType || "").trim() || !String(input.entityId || "").trim()) {
    return { ok: false, error: validationError("INVALID_BODY", "entityType and entityId required") };
  }

  const snapshot = JSON.stringify(input.payload ?? {});
  const preview = {
    target_system: input.targetSystem.trim(),
    entity_type: input.entityType.trim(),
    entity_id: input.entityId.trim(),
    payload_byte_length: Buffer.byteLength(snapshot, "utf8"),
    payload_top_level_keys:
      input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
        ? Object.keys(input.payload).sort()
        : [],
    sync_status_suggestion: "pending",
  };

  return { ok: true, preview };
}

/**
 * Persist outbound sync job (worker / queue will drive retries).
 */
export async function createOutboundSync(
  input: CreateOutboundSyncInput,
): Promise<{ ok: true; outboundSyncId: string } | { ok: false; error: StructuredError }> {
  if (!String(input.targetSystem || "").trim() || !isKnownTarget(input.targetSystem.trim())) {
    return { ok: false, error: validationError("INVALID_TARGET_SYSTEM", "targetSystem unknown") };
  }
  if (!String(input.entityType || "").trim() || !String(input.entityId || "").trim()) {
    return { ok: false, error: validationError("INVALID_BODY", "entityType and entityId required") };
  }

  const snapshot = JSON.stringify(input.payloadSnapshot ?? {});

  try {
    const row = await db.outboundSync.create({
      data: {
        targetSystem: input.targetSystem.trim(),
        entityType: input.entityType.trim(),
        entityId: input.entityId.trim(),
        payloadSnapshotJson: snapshot,
        syncStatus: "pending",
        idempotencyKey: input.idempotencyKey?.trim() || undefined,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
      },
    });
    return { ok: true, outboundSyncId: row.id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return { ok: false, error: validationError("IDEMPOTENCY_CONFLICT", "idempotencyKey already used") };
    }
    throw e;
  }
}

export async function updateOutboundSyncStatus(
  outboundSyncId: string,
  patch: {
    syncStatus: string;
    attemptCount?: number;
    nextRetryAt?: Date | null;
    errorCode?: string | null;
    errorDetail?: Record<string, unknown> | null;
  },
): Promise<{ ok: true } | { ok: false; error: StructuredError }> {
  if (!isSyncStatus(patch.syncStatus)) {
    return { ok: false, error: validationError("INVALID_SYNC_STATUS", "unknown sync status") };
  }
  if (patch.nextRetryAt != null && patch.nextRetryAt.getTime() < Date.now() - 120_000) {
    return { ok: false, error: validationError("INVALID_RETRY", "nextRetryAt is too far in the past") };
  }
  if (patch.attemptCount != null && patch.attemptCount < 0) {
    return { ok: false, error: validationError("INVALID_RETRY", "attemptCount cannot be negative") };
  }

  const data: Prisma.OutboundSyncUpdateInput = {
    syncStatus: patch.syncStatus,
    lastAttemptAt: new Date(),
  };
  if (patch.attemptCount !== undefined) data.attemptCount = patch.attemptCount;
  if (patch.nextRetryAt !== undefined) data.nextRetryAt = patch.nextRetryAt;
  if (patch.errorCode !== undefined) data.errorCode = patch.errorCode;
  if (patch.errorDetail !== undefined) {
    data.errorDetailJson = patch.errorDetail === null ? null : JSON.stringify(patch.errorDetail);
  }

  await db.outboundSync.update({
    where: { id: outboundSyncId },
    data,
  });
  return { ok: true };
}
