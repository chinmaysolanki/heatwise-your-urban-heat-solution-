import { db } from "@/lib/db";
import { stableRequestHash } from "@/lib/httpIdempotency";
import type { IdempotencyExecutionMeta, StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import { REVENUE_EVENT_TYPES, REVENUE_STATUSES } from "@/lib/commercialConstants";
import type { LogRevenueEventInput } from "@/lib/commercialTypes";
import {
  assertIdempotencyPolicy,
  completeIdempotencyRecord,
  releaseIdempotencyReservation,
  reserveIdempotencyKey,
} from "@/lib/services/idempotencyService";

const REFUNDISH = new Set(["refund_issued", "installer_commission_refunded", "subscription_cancelled"]);

function isRevenueEventType(x: string): boolean {
  return (REVENUE_EVENT_TYPES as readonly string[]).includes(x);
}

function isRevenueStatus(x: string): boolean {
  return (REVENUE_STATUSES as readonly string[]).includes(x);
}

function nonNeg(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

/**
 * Append-only revenue / monetization event. Validates types and sane money fields.
 */
type RevenueOk = { ok: true; revenueEventId: string; idempotency?: IdempotencyExecutionMeta };

export async function logRevenueEvent(
  input: LogRevenueEventInput,
): Promise<RevenueOk | { ok: false; error: StructuredError }> {
  const idemKey = input.idempotencyKey?.trim() || null;
  let recordId: string | null = null;

  if (idemKey) {
    const pol = assertIdempotencyPolicy({
      scope: "revenue_event",
      idempotencyKey: idemKey,
      policy: "optional",
    });
    if (!pol.ok) return { ok: false, error: pol.error };
    const hashPayload = { ...input };
    delete (hashPayload as { idempotencyKey?: string }).idempotencyKey;
    const r = await reserveIdempotencyKey("revenue_event", idemKey, stableRequestHash(hashPayload));
    if (r.kind === "replay") {
      const b = r.body as { revenueEventId?: string };
      if (b?.revenueEventId) {
        return {
          ok: true,
          revenueEventId: b.revenueEventId,
          idempotency: { replayed: true, scope: "revenue_event", via: "idempotency_store" },
        };
      }
      return { ok: false, error: validationError("INTERNAL_ERROR", "idempotency replay malformed") };
    }
    if (r.kind === "hash_conflict") {
      return {
        ok: false,
        error: validationError("IDEMPOTENCY_CONFLICT", "idempotency key reused with different body", {
          scope: "revenue_event",
          reason: "hash_mismatch",
        }),
      };
    }
    if (r.kind === "in_flight") {
      return {
        ok: false,
        error: validationError("IDEMPOTENCY_IN_FLIGHT", "duplicate request in progress; retry later", {
          scope: "revenue_event",
          reason: "in_flight",
        }),
      };
    }
    if (r.kind === "error") return { ok: false, error: r.error };
    recordId = r.recordId;
  }

  const fail = async (err: StructuredError) => {
    if (recordId) await releaseIdempotencyReservation(recordId);
    return { ok: false as const, error: err };
  };

  try {
  if (!isRevenueEventType(input.eventType)) {
    return fail(validationError("INVALID_EVENT_TYPE", "unknown revenue event_type"));
  }
  if (!isRevenueStatus(input.revenueStatus)) {
    return fail(validationError("INVALID_STATUS", "unknown revenue_status"));
  }
  if (!String(input.revenueSource || "").trim()) {
    return fail(validationError("INVALID_SOURCE", "revenue_source required"));
  }

  const currency = String(input.currency || "INR").trim().toUpperCase();
  if (currency.length !== 3) {
    return fail(validationError("INVALID_CURRENCY", "currency must be 3-letter code"));
  }

  const gross = input.grossAmount;
  const net = input.netAmount;
  const refund = input.refundAmount;

  if (gross != null && !Number.isFinite(gross)) {
    return fail(validationError("INVALID_MONEY", "gross_amount not finite"));
  }
  if (net != null && !Number.isFinite(net)) {
    return fail(validationError("INVALID_MONEY", "net_amount not finite"));
  }

  const refundish = REFUNDISH.has(input.eventType);
  if (gross != null && gross < 0 && !refundish) {
    return fail(
      validationError("INVALID_MONEY", "negative gross_amount only allowed for refund-like event types"),
    );
  }
  if (gross != null && net != null && gross >= 0 && net > gross + 1e-6 && !refundish) {
    return fail(
      validationError("INVALID_MONEY", "net_amount should not exceed gross_amount for normal revenue"),
    );
  }

  for (const [k, v] of [
    ["commission_amount", input.commissionAmount],
    ["platform_fee_amount", input.platformFeeAmount],
    ["discount_amount", input.discountAmount],
    ["refund_amount", input.refundAmount],
    ["tax_amount", input.taxAmount],
  ] as const) {
    if (v != null && !nonNeg(v)) {
      return fail(validationError("INVALID_MONEY", `${k} must be non-negative when set`));
    }
  }

  const eventTimestamp = input.eventTimestamp ? new Date(input.eventTimestamp) : new Date();
  if (Number.isNaN(eventTimestamp.getTime())) {
    return fail(validationError("INVALID_DATE", "event_timestamp invalid"));
  }

  const row = await db.revenueEvent.create({
    data: {
      eventType: input.eventType,
      eventTimestamp,
      userId: input.userId ?? undefined,
      projectId: input.projectId ?? undefined,
      recommendationSessionId: input.recommendationSessionId ?? undefined,
      quoteRequestId: input.quoteRequestId ?? undefined,
      installerQuoteId: input.installerQuoteId ?? undefined,
      installJobId: input.installJobId ?? undefined,
      installerId: input.installerId ?? undefined,
      currency,
      grossAmount: gross ?? undefined,
      netAmount: net ?? undefined,
      commissionAmount: input.commissionAmount ?? undefined,
      platformFeeAmount: input.platformFeeAmount ?? undefined,
      discountAmount: input.discountAmount ?? undefined,
      refundAmount: refund ?? undefined,
      taxAmount: input.taxAmount ?? undefined,
      revenueStatus: input.revenueStatus,
      paymentStatus: input.paymentStatus ?? undefined,
      revenueSource: input.revenueSource.trim(),
      metadataJson:
        input.metadata && Object.keys(input.metadata).length > 0 ? JSON.stringify(input.metadata) : undefined,
    },
  });

  if (recordId) await completeIdempotencyRecord(recordId, 201, { revenueEventId: row.id });
  return {
    ok: true,
    revenueEventId: row.id,
    idempotency: idemKey ? { replayed: false, scope: "revenue_event" } : undefined,
  };
  } catch (e) {
    if (recordId) await releaseIdempotencyReservation(recordId);
    throw e;
  }
}
