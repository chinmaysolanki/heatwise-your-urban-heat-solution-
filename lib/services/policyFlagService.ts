import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import {
  GOVERNANCE_FLAG_STATUSES,
  GOVERNANCE_FLAG_TYPES,
  GOVERNANCE_SEVERITIES,
} from "@/lib/governanceConstants";
import type { CreatePolicyFlagInput, UpdatePolicyFlagInput } from "@/lib/governanceTypes";

const CUID = /^c[a-z0-9]{24,}$/i;

function inList(v: string, list: readonly string[]): boolean {
  return list.includes(v);
}

export async function createGovernancePolicyFlag(
  input: CreatePolicyFlagInput,
): Promise<{ ok: true; governancePolicyFlagId: string } | { ok: false; error: StructuredError }> {
  const ft = String(input.flagType || "").trim();
  const sev = String(input.severity || "").trim();
  const title = String(input.title || "").trim();

  if (!ft || !inList(ft, GOVERNANCE_FLAG_TYPES)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid flagType") };
  }
  if (!sev || !inList(sev, GOVERNANCE_SEVERITIES)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid severity") };
  }
  if (!title) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "title required") };
  }

  const uid = input.userId?.trim();
  if (uid && !CUID.test(uid)) {
    return { ok: false, error: validationError("INVALID_REFERENCE", "userId must be cuid-like when set") };
  }
  const pid = input.projectId?.trim();
  if (pid && !CUID.test(pid)) {
    return { ok: false, error: validationError("INVALID_REFERENCE", "projectId must be cuid-like when set") };
  }
  const eid = input.entityId?.trim();
  if (eid && !CUID.test(eid)) {
    return { ok: false, error: validationError("INVALID_REFERENCE", "entityId must be cuid-like when set") };
  }

  if (uid) {
    const u = await db.user.findUnique({ where: { id: uid }, select: { id: true } });
    if (!u) return { ok: false, error: validationError("NOT_FOUND", "user not found") };
  }
  if (pid) {
    const p = await db.project.findUnique({ where: { id: pid }, select: { id: true } });
    if (!p) return { ok: false, error: validationError("NOT_FOUND", "project not found") };
  }

  const row = await db.governancePolicyFlag.create({
    data: {
      flagType: ft,
      severity: sev,
      status: "open",
      entityType: input.entityType?.trim() || undefined,
      entityId: eid || undefined,
      userId: uid || undefined,
      projectId: pid || undefined,
      title,
      detailJson: input.detail ? JSON.stringify(input.detail) : undefined,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });

  return { ok: true, governancePolicyFlagId: row.id };
}

export async function updateGovernancePolicyFlag(
  input: UpdatePolicyFlagInput,
): Promise<{ ok: true } | { ok: false; error: StructuredError }> {
  const fid = String(input.flagId || "").trim();
  if (!CUID.test(fid)) {
    return { ok: false, error: validationError("INVALID_REFERENCE", "flagId must be cuid-like") };
  }

  const existing = await db.governancePolicyFlag.findUnique({ where: { id: fid } });
  if (!existing) {
    return { ok: false, error: validationError("NOT_FOUND", "flag not found") };
  }

  const st = input.status?.trim();
  if (st && !inList(st, GOVERNANCE_FLAG_STATUSES)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid status") };
  }
  const sev = input.severity?.trim();
  if (sev && !inList(sev, GOVERNANCE_SEVERITIES)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid severity") };
  }

  const data: {
    status?: string;
    severity?: string;
    resolvedBy?: string;
    detailJson?: string;
    resolvedAt?: Date | null;
  } = {};
  if (st) {
    data.status = st;
    if (st === "resolved" || st === "waived") data.resolvedAt = new Date();
    else if (st === "open" || st === "acknowledged") data.resolvedAt = null;
  }
  if (sev) data.severity = sev;
  if (input.resolvedBy) data.resolvedBy = input.resolvedBy.trim();
  if (input.detail) data.detailJson = JSON.stringify(input.detail);

  await db.governancePolicyFlag.update({
    where: { id: fid },
    data,
  });

  return { ok: true };
}

export async function listGovernancePolicyFlags(options?: {
  status?: string;
  limit?: number;
}): Promise<{ items: unknown[] }> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const rows = await db.governancePolicyFlag.findMany({
    where: options?.status ? { status: options.status } : undefined,
    orderBy: { raisedAt: "desc" },
    take: limit,
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      flagType: r.flagType,
      severity: r.severity,
      status: r.status,
      entityType: r.entityType,
      entityId: r.entityId,
      userId: r.userId,
      projectId: r.projectId,
      title: r.title,
      raisedAt: r.raisedAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
    })),
  };
}
