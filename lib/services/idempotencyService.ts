import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import { IDEMPOTENCY_SCOPES } from "@/lib/platformHardeningConstants";
import type { IdempotencyPolicy, IdempotencyRequestDescriptor } from "@/lib/platformHardeningTypes";

function isScope(x: string): boolean {
  return (IDEMPOTENCY_SCOPES as readonly string[]).includes(x);
}

/**
 * Enforce idempotency key presence when policy requires it (call at API boundary before DB work).
 */
export function assertIdempotencyPolicy(desc: IdempotencyRequestDescriptor): { ok: true } | { ok: false; error: StructuredError } {
  const scope = String(desc.scope || "").trim();
  if (!scope || !isScope(scope)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid idempotency scope") };
  }
  const key = desc.idempotencyKey?.trim() || "";
  if (desc.policy === "required" && !key) {
    return { ok: false, error: validationError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header or body idempotencyKey required for this operation") };
  }
  if (desc.policy === "optional" && !key) {
    return { ok: true };
  }
  return { ok: true };
}

export type ReserveIdempotencyResult =
  | { kind: "new"; recordId: string }
  | { kind: "replay"; httpStatus: number; body: unknown }
  | { kind: "in_flight" }
  | { kind: "hash_conflict" }
  | { kind: "error"; error: StructuredError };

/**
 * Claim an idempotency key or return a prior completed response.
 * Caller should `completeIdempotencyRecord` after successful write or `releaseIdempotencyReservation` on failure before retry.
 */
export async function reserveIdempotencyKey(
  scope: string,
  idempotencyKey: string,
  requestHash: string | null,
): Promise<ReserveIdempotencyResult> {
  const sc = scope.trim();
  const key = idempotencyKey.trim();
  if (!isScope(sc) || !key) {
    return { kind: "error", error: validationError("VALIDATION_FAILED", "scope and idempotencyKey required") };
  }

  try {
    const row = await db.idempotencyRecord.create({
      data: {
        scope: sc,
        idempotencyKey: key,
        requestHash: requestHash?.trim() || undefined,
        status: "in_flight",
      },
    });
    return { kind: "new", recordId: row.id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("Unique constraint") && !msg.includes("unique")) {
      throw e;
    }
  }

  const existing = await db.idempotencyRecord.findUnique({
    where: { scope_idempotencyKey: { scope: sc, idempotencyKey: key } },
  });
  if (!existing) {
    return { kind: "error", error: validationError("INTERNAL_ERROR", "idempotency race; retry") };
  }

  if (requestHash && existing.requestHash && existing.requestHash !== requestHash.trim()) {
    return { kind: "hash_conflict" };
  }

  if (existing.status === "completed" && existing.responseBodyJson != null && existing.httpStatus != null) {
    let body: unknown;
    try {
      body = JSON.parse(existing.responseBodyJson) as unknown;
    } catch {
      body = { _parseError: true, raw: existing.responseBodyJson };
    }
    return { kind: "replay", httpStatus: existing.httpStatus, body };
  }

  if (existing.status === "in_flight") {
    return { kind: "in_flight" };
  }

  return { kind: "in_flight" };
}

export async function completeIdempotencyRecord(
  recordId: string,
  httpStatus: number,
  responseBody: unknown,
): Promise<void> {
  await db.idempotencyRecord.update({
    where: { id: recordId },
    data: {
      status: "completed",
      httpStatus,
      responseBodyJson: JSON.stringify(responseBody ?? null),
      completedAt: new Date(),
    },
  });
}

export async function releaseIdempotencyReservation(recordId: string): Promise<void> {
  try {
    await db.idempotencyRecord.delete({ where: { id: recordId } });
  } catch {
    /* ignore missing */
  }
}
