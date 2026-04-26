import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import { assertMismatchReasonCodes } from "@/lib/verifiedOutcomesValidation";
import { canTransitionJob } from "@/lib/verifiedOutcomesValidation";

export async function acceptQuoteAndCreateJob(
  installerQuoteId: string,
  installPlan: Record<string, unknown>,
): Promise<{ ok: true; installJobId: string } | { ok: false; error: StructuredError }> {
  const quote = await db.installerQuote.findUnique({
    where: { id: installerQuoteId },
    include: { quoteRequest: true },
  });
  if (!quote) return { ok: false, error: validationError("NOT_FOUND", "quote not found") };
  if (quote.quoteStatus !== "submitted") {
    return { ok: false, error: validationError("QUOTE_NOT_SUBMITTED", "quote not in submitted state") };
  }

  const planJson = JSON.stringify(installPlan ?? {});
  if (planJson === "{}") {
    return { ok: false, error: validationError("INVALID_PLAN", "installPlan required") };
  }

  const result = await db.$transaction(async (tx) => {
    await tx.installerQuote.updateMany({
      where: { quoteRequestId: quote.quoteRequestId, id: { not: installerQuoteId } },
      data: { quoteStatus: "superseded" },
    });
    await tx.installerQuote.update({
      where: { id: installerQuoteId },
      data: { quoteStatus: "accepted" },
    });

    const job = await tx.installerInstallJob.create({
      data: {
        quoteRequestId: quote.quoteRequestId,
        projectId: quote.quoteRequest.projectId,
        userId: quote.quoteRequest.userId,
        installerId: quote.installerId,
        sourceQuoteId: installerQuoteId,
        selectedCandidateSnapshotId: quote.quoteRequest.selectedCandidateSnapshotId,
        jobStatus: "scheduled",
        installPlanJson: planJson,
        estimatedCostInr: quote.quoteAmountInr,
      },
    });

    await tx.installerQuoteRequest.update({
      where: { id: quote.quoteRequestId },
      data: { requestStatus: "accepted" },
    });

    return job;
  });

  return { ok: true, installJobId: result.id };
}

export async function declineQuoteAssignment(
  quoteAssignmentId: string,
  reasonCodes: unknown,
): Promise<{ ok: true } | { ok: false; error: StructuredError }> {
  if (!Array.isArray(reasonCodes)) {
    return { ok: false, error: validationError("INVALID_BODY", "reasonCodes must be an array") };
  }
  const codes = assertMismatchReasonCodes(reasonCodes);
  if ("code" in codes) return { ok: false, error: codes };
  if (codes.length === 0) {
    return { ok: false, error: validationError("REASON_REQUIRED", "rejection reason codes required") };
  }

  await db.installerQuoteAssignment.update({
    where: { id: quoteAssignmentId },
    data: {
      assignmentStatus: "declined",
      declinedAt: new Date(),
      rejectionReasonCodesJson: JSON.stringify(codes),
    },
  });
  return { ok: true };
}

export async function cancelInstallJob(
  installJobId: string,
  reason: string,
  reasonCodes?: unknown,
): Promise<{ ok: true } | { ok: false; error: StructuredError }> {
  if (!reason?.trim()) {
    return { ok: false, error: validationError("REQUIRED_FIELD", "cancellation reason required") };
  }
  const job = await db.installerInstallJob.findUnique({ where: { id: installJobId } });
  if (!job) return { ok: false, error: validationError("NOT_FOUND", "job not found") };
  if (!canTransitionJob(job.jobStatus, "cancelled")) {
    return { ok: false, error: validationError("INVALID_TRANSITION", "cannot cancel from this status") };
  }

  let codesJson: string | null = null;
  if (reasonCodes != null) {
    const c = assertMismatchReasonCodes(reasonCodes);
    if ("code" in c) return { ok: false, error: c };
    codesJson = JSON.stringify(c);
  }

  await db.installerInstallJob.update({
    where: { id: installJobId },
    data: {
      jobStatus: "cancelled",
      cancelledAt: new Date(),
      cancellationReason: reason.trim(),
      cancellationReasonCodesJson: codesJson,
    },
  });
  return { ok: true };
}

export async function updateInstallJobStatus(
  installJobId: string,
  nextStatus: string,
  patch: {
    scheduledDate?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    finalCostInr?: number | null;
    jobNotes?: string | null;
  } = {},
): Promise<{ ok: true } | { ok: false; error: StructuredError }> {
  const job = await db.installerInstallJob.findUnique({ where: { id: installJobId } });
  if (!job) return { ok: false, error: validationError("NOT_FOUND", "job not found") };
  if (!canTransitionJob(job.jobStatus, nextStatus)) {
    return {
      ok: false,
      error: validationError("INVALID_TRANSITION", "status transition not allowed", {
        from: job.jobStatus,
        to: nextStatus,
      }),
    };
  }

  if (nextStatus === "completed" && !patch.completedAt) {
    return { ok: false, error: validationError("REQUIRED_FIELD", "completedAt required for completed") };
  }

  await db.installerInstallJob.update({
    where: { id: installJobId },
    data: {
      jobStatus: nextStatus,
      ...(patch.scheduledDate !== undefined && {
        scheduledDate: patch.scheduledDate ? new Date(patch.scheduledDate) : null,
      }),
      ...(patch.startedAt !== undefined && {
        startedAt: patch.startedAt ? new Date(patch.startedAt) : null,
      }),
      ...(patch.completedAt !== undefined && {
        completedAt: patch.completedAt ? new Date(patch.completedAt) : null,
      }),
      ...(patch.finalCostInr !== undefined && { finalCostInr: patch.finalCostInr }),
      ...(patch.jobNotes !== undefined && { jobNotes: patch.jobNotes }),
    },
  });
  return { ok: true };
}
