import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import {
  GOVERNANCE_REVIEW_PRIORITIES,
  GOVERNANCE_REVIEW_STATUSES,
  GOVERNANCE_REVIEW_TYPES,
} from "@/lib/governanceConstants";
import type { CreateGovernanceReviewInput, UpdateGovernanceReviewInput } from "@/lib/governanceTypes";

const CUID = /^c[a-z0-9]{24,}$/i;

function inList(v: string, list: readonly string[]): boolean {
  return list.includes(v);
}

export async function createGovernanceReview(
  input: CreateGovernanceReviewInput,
): Promise<{ ok: true; governanceReviewRecordId: string } | { ok: false; error: StructuredError }> {
  const rt = String(input.reviewType || "").trim();
  if (!rt || !inList(rt, GOVERNANCE_REVIEW_TYPES)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid reviewType") };
  }

  const subType = String(input.subjectEntityType || "").trim();
  const subId = String(input.subjectEntityId || "").trim();
  if (!subType || !subId || !CUID.test(subId)) {
    return {
      ok: false,
      error: validationError("INVALID_REFERENCE", "subjectEntityType and cuid-like subjectEntityId required"),
    };
  }

  const pr = input.priority?.trim() || "normal";
  if (!inList(pr, GOVERNANCE_REVIEW_PRIORITIES)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid priority") };
  }

  const ru = input.relatedUserId?.trim();
  if (ru && !CUID.test(ru)) {
    return { ok: false, error: validationError("INVALID_REFERENCE", "relatedUserId must be cuid-like") };
  }
  const rp = input.relatedProjectId?.trim();
  if (rp && !CUID.test(rp)) {
    return { ok: false, error: validationError("INVALID_REFERENCE", "relatedProjectId must be cuid-like") };
  }

  if (ru) {
    const u = await db.user.findUnique({ where: { id: ru }, select: { id: true } });
    if (!u) return { ok: false, error: validationError("NOT_FOUND", "relatedUserId not found") };
  }
  if (rp) {
    const p = await db.project.findUnique({ where: { id: rp }, select: { id: true } });
    if (!p) return { ok: false, error: validationError("NOT_FOUND", "relatedProjectId not found") };
  }

  const row = await db.governanceReviewRecord.create({
    data: {
      reviewType: rt,
      status: "queued",
      priority: pr,
      subjectEntityType: subType,
      subjectEntityId: subId,
      relatedUserId: ru || undefined,
      relatedProjectId: rp || undefined,
      openedByActorId: input.openedByActorId?.trim() || undefined,
      openedByActorType: input.openedByActorType?.trim() || undefined,
      findingsJson: input.findings ? JSON.stringify(input.findings) : undefined,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });

  return { ok: true, governanceReviewRecordId: row.id };
}

export async function updateGovernanceReview(
  input: UpdateGovernanceReviewInput,
): Promise<{ ok: true } | { ok: false; error: StructuredError }> {
  const rid = String(input.reviewId || "").trim();
  if (!CUID.test(rid)) {
    return { ok: false, error: validationError("INVALID_REFERENCE", "reviewId must be cuid-like") };
  }

  const existing = await db.governanceReviewRecord.findUnique({ where: { id: rid } });
  if (!existing) {
    return { ok: false, error: validationError("NOT_FOUND", "review not found") };
  }

  const st = input.status?.trim();
  if (st && !inList(st, GOVERNANCE_REVIEW_STATUSES)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid status") };
  }
  const pr = input.priority?.trim();
  if (pr && !inList(pr, GOVERNANCE_REVIEW_PRIORITIES)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid priority") };
  }

  const data: {
    status?: string;
    priority?: string;
    resolutionSummary?: string | null;
    assignedToActorId?: string | null;
    findingsJson?: string;
    closedAt?: Date | null;
  } = {};
  if (st) {
    data.status = st;
    if (st === "approved" || st === "rejected" || st === "escalated") data.closedAt = new Date();
    else if (st === "queued" || st === "in_review") data.closedAt = null;
  }
  if (pr) data.priority = pr;
  if (input.resolutionSummary != null) data.resolutionSummary = input.resolutionSummary.trim() || null;
  if (input.assignedToActorId != null) data.assignedToActorId = input.assignedToActorId.trim() || null;
  if (input.findings) data.findingsJson = JSON.stringify(input.findings);

  await db.governanceReviewRecord.update({
    where: { id: rid },
    data,
  });

  return { ok: true };
}

export async function listGovernanceReviews(options?: {
  status?: string;
  limit?: number;
}): Promise<{ items: unknown[] }> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const rows = await db.governanceReviewRecord.findMany({
    where: options?.status ? { status: options.status } : undefined,
    orderBy: { openedAt: "desc" },
    take: limit,
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      reviewType: r.reviewType,
      status: r.status,
      priority: r.priority,
      subjectEntityType: r.subjectEntityType,
      subjectEntityId: r.subjectEntityId,
      relatedUserId: r.relatedUserId,
      relatedProjectId: r.relatedProjectId,
      openedAt: r.openedAt.toISOString(),
      closedAt: r.closedAt?.toISOString() ?? null,
      resolutionSummary: r.resolutionSummary,
    })),
  };
}
