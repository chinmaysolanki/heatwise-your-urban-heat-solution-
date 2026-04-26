import { db } from "@/lib/db";
import { stableRequestHash } from "@/lib/httpIdempotency";
import type { IdempotencyExecutionMeta, StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import { assertMismatchReasonCodes } from "@/lib/verifiedOutcomesValidation";
import {
  assertIdempotencyPolicy,
  completeIdempotencyRecord,
  releaseIdempotencyReservation,
  reserveIdempotencyKey,
} from "@/lib/services/idempotencyService";

export type CreateQuoteRequestInput = {
  projectId: string;
  userId: string | null;
  recommendationSessionId?: string | null;
  selectedCandidateSnapshotId?: string | null;
  userLocationRegion: string;
  projectSnapshot: Record<string, unknown>;
  candidateSnapshot?: Record<string, unknown> | null;
  notes?: string | null;
  /** When set, duplicate POSTs with the same key replay the same `quoteRequestId`. */
  idempotencyKey?: string | null;
};

type QuoteRequestOk = { ok: true; quoteRequestId: string; idempotency?: IdempotencyExecutionMeta };

export async function createQuoteRequest(
  input: CreateQuoteRequestInput,
): Promise<QuoteRequestOk | { ok: false; error: StructuredError }> {
  const idemKey = input.idempotencyKey?.trim() || null;
  let recordId: string | null = null;

  if (idemKey) {
    const pol = assertIdempotencyPolicy({
      scope: "quote_action",
      idempotencyKey: idemKey,
      policy: "optional",
    });
    if (!pol.ok) return { ok: false, error: pol.error };
    const hashPayload = { ...input };
    delete (hashPayload as { idempotencyKey?: string }).idempotencyKey;
    const r = await reserveIdempotencyKey("quote_action", idemKey, stableRequestHash(hashPayload));
    if (r.kind === "replay") {
      const b = r.body as { quoteRequestId?: string };
      if (b?.quoteRequestId) {
        return {
          ok: true,
          quoteRequestId: b.quoteRequestId,
          idempotency: { replayed: true, scope: "quote_action", via: "idempotency_store" },
        };
      }
      return { ok: false, error: validationError("INTERNAL_ERROR", "idempotency replay malformed") };
    }
    if (r.kind === "hash_conflict") {
      return {
        ok: false,
        error: validationError("IDEMPOTENCY_CONFLICT", "idempotency key reused with different body", {
          scope: "quote_action",
          reason: "hash_mismatch",
        }),
      };
    }
    if (r.kind === "in_flight") {
      return {
        ok: false,
        error: validationError("IDEMPOTENCY_IN_FLIGHT", "duplicate request in progress; retry later", {
          scope: "quote_action",
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
    if (!input.userLocationRegion?.trim()) {
      return fail(validationError("REQUIRED_FIELD", "userLocationRegion required"));
    }

    if (input.recommendationSessionId) {
      const s = await db.recommendationTelemetrySession.findUnique({
        where: { id: input.recommendationSessionId },
      });
      if (!s || s.projectId !== input.projectId) {
        return fail(validationError("SESSION_MISMATCH", "recommendation session invalid"));
      }
    }

    if (input.selectedCandidateSnapshotId) {
      const c = await db.recommendationCandidateSnapshot.findUnique({
        where: { id: input.selectedCandidateSnapshotId },
        include: { session: { select: { projectId: true } } },
      });
      if (!c || c.session.projectId !== input.projectId) {
        return fail(validationError("SNAPSHOT_MISMATCH", "candidate snapshot invalid"));
      }
    }

    const row = await db.installerQuoteRequest.create({
      data: {
        projectId: input.projectId,
        userId: input.userId,
        recommendationSessionId: input.recommendationSessionId ?? null,
        selectedCandidateSnapshotId: input.selectedCandidateSnapshotId ?? null,
        userLocationRegion: input.userLocationRegion.trim(),
        projectSnapshotJson: JSON.stringify(input.projectSnapshot ?? {}),
        candidateSnapshotJson: input.candidateSnapshot ? JSON.stringify(input.candidateSnapshot) : null,
        notes: input.notes ?? null,
        requestStatus: "submitted",
      },
    });

    if (recordId) await completeIdempotencyRecord(recordId, 201, { quoteRequestId: row.id });
    return {
      ok: true,
      quoteRequestId: row.id,
      idempotency: idemKey ? { replayed: false, scope: "quote_action" } : undefined,
    };
  } catch (e) {
    if (recordId) await releaseIdempotencyReservation(recordId);
    throw e;
  }
}

export type SubmitQuoteInput = {
  quoteRequestId: string;
  quoteAssignmentId: string;
  installerId: string;
  quoteAmountInr: number;
  estimatedTimelineDays: number;
  includedScope: Record<string, unknown>;
  excludedScope?: Record<string, unknown> | null;
  proposedSpecies?: unknown;
  proposedMaterials?: unknown;
  notes?: string | null;
  deviationFromRecommendationFlags?: string[] | null;
  idempotencyKey?: string | null;
};

type SubmitQuoteOk = { ok: true; installerQuoteId: string; idempotency?: IdempotencyExecutionMeta };

export async function submitInstallerQuote(
  input: SubmitQuoteInput,
): Promise<SubmitQuoteOk | { ok: false; error: StructuredError }> {
  const idemKey = input.idempotencyKey?.trim() || null;
  let recordId: string | null = null;

  if (idemKey) {
    const pol = assertIdempotencyPolicy({
      scope: "quote_action",
      idempotencyKey: idemKey,
      policy: "optional",
    });
    if (!pol.ok) return { ok: false, error: pol.error };
    const hashPayload = { ...input };
    delete (hashPayload as { idempotencyKey?: string }).idempotencyKey;
    const r = await reserveIdempotencyKey("quote_action", idemKey, stableRequestHash(hashPayload));
    if (r.kind === "replay") {
      const b = r.body as { installerQuoteId?: string };
      if (b?.installerQuoteId) {
        return {
          ok: true,
          installerQuoteId: b.installerQuoteId,
          idempotency: { replayed: true, scope: "quote_action", via: "idempotency_store" },
        };
      }
      return { ok: false, error: validationError("INTERNAL_ERROR", "idempotency replay malformed") };
    }
    if (r.kind === "hash_conflict") {
      return {
        ok: false,
        error: validationError("IDEMPOTENCY_CONFLICT", "idempotency key reused with different body", {
          scope: "quote_action",
          reason: "hash_mismatch",
        }),
      };
    }
    if (r.kind === "in_flight") {
      return {
        ok: false,
        error: validationError("IDEMPOTENCY_IN_FLIGHT", "duplicate request in progress; retry later", {
          scope: "quote_action",
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
    const existingQuote = await db.installerQuote.findFirst({
      where: { quoteAssignmentId: input.quoteAssignmentId },
    });
    if (existingQuote) {
      if (recordId) {
        await completeIdempotencyRecord(recordId, 201, {
          installerQuoteId: existingQuote.id,
          idempotentReplay: true,
        });
      }
      return {
        ok: true,
        installerQuoteId: existingQuote.id,
        idempotency: { replayed: true, scope: "quote_action", via: "quote_assignment_natural" },
      };
    }

    if (input.quoteAmountInr <= 0 || input.estimatedTimelineDays < 1 || input.estimatedTimelineDays > 730) {
      return fail(validationError("INVALID_QUOTE", "amount or timeline invalid"));
    }

    const assign = await db.installerQuoteAssignment.findUnique({
      where: { id: input.quoteAssignmentId },
      include: { quoteRequest: true },
    });
    if (!assign || assign.quoteRequestId !== input.quoteRequestId || assign.installerId !== input.installerId) {
      return fail(validationError("ASSIGNMENT_MISMATCH", "assignment invalid"));
    }
    if (assign.assignmentStatus === "declined") {
      return fail(validationError("ASSIGNMENT_DECLINED", "cannot quote declined assignment"));
    }

    const flags = input.deviationFromRecommendationFlags ?? [];
    const flagCheck = assertMismatchReasonCodes(flags);
    if ("code" in flagCheck) return fail(flagCheck);

    const quote = await db.installerQuote.create({
      data: {
        quoteRequestId: input.quoteRequestId,
        quoteAssignmentId: input.quoteAssignmentId,
        installerId: input.installerId,
        quoteAmountInr: input.quoteAmountInr,
        estimatedTimelineDays: input.estimatedTimelineDays,
        includedScopeJson: JSON.stringify(input.includedScope ?? {}),
        excludedScopeJson: input.excludedScope ? JSON.stringify(input.excludedScope) : null,
        proposedSpeciesJson: input.proposedSpecies ? JSON.stringify(input.proposedSpecies) : null,
        proposedMaterialsJson: input.proposedMaterials ? JSON.stringify(input.proposedMaterials) : null,
        notes: input.notes ?? null,
        deviationFromRecommendationFlagsJson: JSON.stringify(flags),
        quoteStatus: "submitted",
      },
    });

    await db.installerQuoteAssignment.update({
      where: { id: input.quoteAssignmentId },
      data: { assignmentStatus: "quoted" },
    });

    await db.installerQuoteRequest.update({
      where: { id: input.quoteRequestId },
      data: { requestStatus: "quote_received" },
    });

    if (recordId) await completeIdempotencyRecord(recordId, 201, { installerQuoteId: quote.id });
    return {
      ok: true,
      installerQuoteId: quote.id,
      idempotency: idemKey ? { replayed: false, scope: "quote_action" } : undefined,
    };
  } catch (e) {
    if (recordId) await releaseIdempotencyReservation(recordId);
    throw e;
  }
}
