import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

export type SubmitRemeasurementInput = {
  projectId: string;
  scheduleId?: string | null;
  checkpointId?: string | null;
  measuredAt?: string | Date | null;
  windowLabel: string;
  plantSurvivalRate?: number | null;
  surfaceTempDeltaC?: number | null;
  userSatisfactionScore?: number | null;
  maintenanceAdherenceScore?: number | null;
  heatMitigationStabilityScore?: number | null;
  qualitativeNotes?: string | null;
  evidenceRefs?: unknown;
  ambientContext?: Record<string, unknown> | null;
};

function inRange(v: number | null | undefined, lo: number, hi: number, field: string): StructuredError | null {
  if (v === undefined || v === null) return null;
  if (Number.isNaN(v) || v < lo || v > hi) {
    return validationError("INVALID_RANGE", `${field} out of range`, { lo, hi, value: v });
  }
  return null;
}

export async function submitRemeasurement(
  input: SubmitRemeasurementInput,
): Promise<{ ok: true; remeasurementId: string } | { ok: false; error: StructuredError }> {
  const wl = input.windowLabel.trim();
  if (!wl || (wl !== "ad_hoc" && (!wl.endsWith("d") || Number.isNaN(Number.parseInt(wl.slice(0, -1), 10))))) {
    return { ok: false, error: validationError("INVALID_WINDOW_LABEL", "windowLabel must be like 7d or ad_hoc") };
  }

  for (const e of [
    inRange(input.plantSurvivalRate ?? null, 0, 1, "plantSurvivalRate"),
    inRange(input.maintenanceAdherenceScore ?? null, 0, 1, "maintenanceAdherenceScore"),
    inRange(input.heatMitigationStabilityScore ?? null, 0, 1, "heatMitigationStabilityScore"),
    inRange(input.userSatisfactionScore ?? null, 0, 5, "userSatisfactionScore"),
    inRange(input.surfaceTempDeltaC ?? null, -25, 25, "surfaceTempDeltaC"),
  ]) {
    if (e) return { ok: false, error: e };
  }

  if (input.checkpointId) {
    const cp = await db.longitudinalFollowupCheckpoint.findUnique({
      where: { id: input.checkpointId },
      include: { schedule: true },
    });
    if (!cp || cp.schedule.projectId !== input.projectId) {
      return { ok: false, error: validationError("CHECKPOINT_MISMATCH", "checkpoint not on project") };
    }
  }

  if (input.scheduleId) {
    const s = await db.longitudinalFollowupSchedule.findUnique({
      where: { id: input.scheduleId },
      select: { projectId: true },
    });
    if (!s || s.projectId !== input.projectId) {
      return { ok: false, error: validationError("SCHEDULE_MISMATCH", "schedule not on project") };
    }
  }

  const measuredAt = input.measuredAt ? new Date(input.measuredAt) : new Date();
  if (Number.isNaN(measuredAt.getTime())) {
    return { ok: false, error: validationError("INVALID_DATE", "measuredAt invalid") };
  }

  const row = await db.longitudinalRemeasurement.create({
    data: {
      projectId: input.projectId,
      scheduleId: input.scheduleId ?? null,
      checkpointId: input.checkpointId ?? null,
      measuredAt,
      windowLabel: wl,
      plantSurvivalRate: input.plantSurvivalRate ?? null,
      surfaceTempDeltaC: input.surfaceTempDeltaC ?? null,
      userSatisfactionScore: input.userSatisfactionScore ?? null,
      maintenanceAdherenceScore: input.maintenanceAdherenceScore ?? null,
      heatMitigationStabilityScore: input.heatMitigationStabilityScore ?? null,
      qualitativeNotes: input.qualitativeNotes ?? null,
      evidenceRefsJson: input.evidenceRefs ? JSON.stringify(input.evidenceRefs) : null,
      ambientContextJson: input.ambientContext ? JSON.stringify(input.ambientContext) : null,
    },
  });

  return { ok: true, remeasurementId: row.id };
}

export async function listDueFollowups(before: Date, limit: number) {
  return db.longitudinalFollowupCheckpoint.findMany({
    where: {
      checkpointStatus: "pending",
      dueAt: { lte: before },
    },
    include: {
      schedule: {
        include: {
          project: { select: { id: true, name: true, userId: true } },
        },
      },
    },
    orderBy: { dueAt: "asc" },
    take: Math.min(Math.max(limit, 1), 500),
  });
}
