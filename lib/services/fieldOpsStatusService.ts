import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import { AVAILABILITY_STATES, OVERLOAD_SIGNALS, PAUSE_STATES } from "@/lib/partnerOperationsConstants";
import type { UpsertFieldOpsStatusInput } from "@/lib/partnerOperationsTypes";

const CUID = /^c[a-z0-9]{24,}$/i;

function inList(v: string, list: readonly string[]): boolean {
  return list.includes(v);
}

export async function upsertPartnerFieldOpsStatus(
  input: UpsertFieldOpsStatusInput,
): Promise<{ ok: true; partnerFieldOpsStatusId: string } | { ok: false; error: StructuredError }> {
  const iid = String(input.installerId || "").trim();
  if (!CUID.test(iid)) {
    return { ok: false, error: validationError("INVALID_PARTNER_REFERENCE", "installerId must be cuid-like") };
  }

  const inst = await db.installerProfile.findUnique({ where: { id: iid }, select: { id: true } });
  if (!inst) {
    return { ok: false, error: validationError("NOT_FOUND", "installer profile not found") };
  }

  const av = input.availabilityState?.trim() || "available";
  if (!inList(av, AVAILABILITY_STATES)) {
    return { ok: false, error: validationError("INVALID_READINESS_STATE", "invalid availabilityState") };
  }

  const ps = input.pauseState?.trim() || null;
  if (ps && !inList(ps, PAUSE_STATES)) {
    return { ok: false, error: validationError("INVALID_READINESS_STATE", "invalid pauseState") };
  }

  const ol = input.overloadSignal?.trim() || "none";
  if (!inList(ol, OVERLOAD_SIGNALS)) {
    return { ok: false, error: validationError("INVALID_READINESS_STATE", "invalid overloadSignal") };
  }

  const gaps = input.coverageGaps;
  if (gaps != null && !Array.isArray(gaps)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "coverageGaps must be an array when set") };
  }

  const row = await db.partnerFieldOpsStatus.upsert({
    where: { installerId: iid },
    create: {
      installerId: iid,
      availabilityState: av,
      pauseState: ps ?? undefined,
      overloadSignal: ol,
      coverageGapsJson: gaps != null ? JSON.stringify(gaps) : undefined,
      regionalReadinessJson: JSON.stringify(input.regionalReadiness ?? {}),
      signalNotesJson: input.signalNotes ? JSON.stringify(input.signalNotes) : undefined,
    },
    update: {
      availabilityState: av,
      pauseState: ps ?? undefined,
      overloadSignal: ol,
      coverageGapsJson: gaps != null ? JSON.stringify(gaps) : undefined,
      regionalReadinessJson: JSON.stringify(input.regionalReadiness ?? {}),
      signalNotesJson: input.signalNotes ? JSON.stringify(input.signalNotes) : undefined,
    },
  });

  return { ok: true, partnerFieldOpsStatusId: row.id };
}

export async function getPartnerFieldOpsStatus(
  installerId: string,
): Promise<{ ok: true; status: Record<string, unknown> | null } | { ok: false; error: StructuredError }> {
  const iid = String(installerId || "").trim();
  if (!CUID.test(iid)) {
    return { ok: false, error: validationError("INVALID_PARTNER_REFERENCE", "installerId must be cuid-like") };
  }
  const row = await db.partnerFieldOpsStatus.findUnique({ where: { installerId: iid } });
  if (!row) return { ok: true, status: null };
  return {
    ok: true,
    status: {
      installerId: row.installerId,
      availabilityState: row.availabilityState,
      pauseState: row.pauseState,
      overloadSignal: row.overloadSignal,
      coverageGaps: row.coverageGapsJson ? (JSON.parse(row.coverageGapsJson) as unknown[]) : [],
      regionalReadiness: JSON.parse(row.regionalReadinessJson || "{}") as Record<string, unknown>,
      signalNotes: row.signalNotesJson ? (JSON.parse(row.signalNotesJson) as Record<string, unknown>) : null,
      updatedAt: row.updatedAt.toISOString(),
    },
  };
}

/** Aggregate snapshot for admin: count partners by availability (installer-level field ops). */
export async function aggregateFieldOpsSummary(): Promise<{
  byAvailability: Record<string, number>;
  pausedCount: number;
  overloadHardCount: number;
  partnerRows: number;
}> {
  const rows = await db.partnerFieldOpsStatus.findMany({
    select: { availabilityState: true, pauseState: true, overloadSignal: true },
  });
  const byAvailability: Record<string, number> = {};
  let pausedCount = 0;
  let overloadHardCount = 0;
  for (const r of rows) {
    byAvailability[r.availabilityState] = (byAvailability[r.availabilityState] ?? 0) + 1;
    if (r.pauseState) pausedCount += 1;
    if (r.overloadSignal === "hard") overloadHardCount += 1;
  }
  return { byAvailability, pausedCount, overloadHardCount, partnerRows: rows.length };
}
