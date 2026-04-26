import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import { DELIVERY_STATUSES } from "@/lib/integrationConstants";
import type { CreateDeliveryInput, UpdateDeliveryStatusInput } from "@/lib/integrationTypes";

function isDeliveryStatus(x: string): boolean {
  return (DELIVERY_STATUSES as readonly string[]).includes(x);
}

export async function createDeliveryTracking(
  input: CreateDeliveryInput,
): Promise<{ ok: true; deliveryTrackingId: string } | { ok: false; error: StructuredError }> {
  if (!String(input.deliveryType || "").trim() || !String(input.channel || "").trim() || !String(input.targetRef || "").trim()) {
    return { ok: false, error: validationError("INVALID_BODY", "deliveryType, channel, targetRef required") };
  }

  const row = await db.deliveryTracking.create({
    data: {
      deliveryType: input.deliveryType.trim(),
      channel: input.channel.trim(),
      targetRef: input.targetRef.trim(),
      relatedEntityType: input.relatedEntityType?.trim() || undefined,
      relatedEntityId: input.relatedEntityId?.trim() || undefined,
      correlationId: input.correlationId?.trim() || undefined,
      outboundSyncId: input.outboundSyncId?.trim() || undefined,
      deliveryStatus: "queued",
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });
  return { ok: true, deliveryTrackingId: row.id };
}

export async function updateDeliveryStatus(
  input: UpdateDeliveryStatusInput,
): Promise<{ ok: true } | { ok: false; error: StructuredError }> {
  if (!String(input.deliveryTrackingId || "").trim()) {
    return { ok: false, error: validationError("INVALID_BODY", "deliveryTrackingId required") };
  }
  if (!isDeliveryStatus(input.deliveryStatus)) {
    return { ok: false, error: validationError("INVALID_DELIVERY_STATUS", "unknown delivery status") };
  }

  const existing = await db.deliveryTracking.findUnique({
    where: { id: input.deliveryTrackingId.trim() },
  });
  if (!existing) {
    return { ok: false, error: validationError("NOT_FOUND", "deliveryTrackingId not found") };
  }

  const nextAttempt =
    input.incrementAttempt === true ? existing.attemptCount + 1 : existing.attemptCount;
  if (nextAttempt < 0) {
    return { ok: false, error: validationError("INVALID_RETRY", "attemptCount cannot be negative") };
  }

  await db.deliveryTracking.update({
    where: { id: existing.id },
    data: {
      deliveryStatus: input.deliveryStatus,
      attemptCount: nextAttempt,
      lastAttemptAt: input.incrementAttempt ? new Date() : existing.lastAttemptAt,
      lastStatusDetailJson: input.lastStatusDetail ? JSON.stringify(input.lastStatusDetail) : undefined,
    },
  });
  return { ok: true };
}
