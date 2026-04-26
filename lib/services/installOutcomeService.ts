import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type {
  IdempotencyExecutionMeta,
  SubmitInstallOutcomeInput,
  StructuredError,
} from "@/lib/recommendationTelemetryTypes";
import {
  assertInstallOutcomeRules,
  assertInstallStatus,
  assertNonEmptyString,
  assertOptionalScore,
  assertInr,
  assertTempDelta,
  isStructuredError,
  validationError,
} from "@/lib/recommendationTelemetryValidation";

type InstallOutcomeOk = { ok: true; installOutcomeId: string; idempotency?: IdempotencyExecutionMeta };

export async function submitInstallOutcome(
  input: SubmitInstallOutcomeInput,
): Promise<InstallOutcomeOk | { ok: false; error: StructuredError }> {
  if (input.idempotencyKey) {
    const existing = await db.installOutcomeRecord.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return {
        ok: true,
        installOutcomeId: existing.id,
        idempotency: { replayed: true, scope: "install_outcome", via: "install_outcome_key" },
      };
    }
  }

  const pid = assertNonEmptyString(input.projectId, "projectId");
  if (isStructuredError(pid)) return { ok: false, error: pid };

  const st = assertInstallStatus(input.installStatus);
  if (isStructuredError(st)) return { ok: false, error: st };

  const combo = assertInstallOutcomeRules(st, input.installDate);
  if (combo) return { ok: false, error: combo };

  const uss = assertOptionalScore(input.userSatisfactionScore, "userSatisfactionScore");
  if (isStructuredError(uss)) return { ok: false, error: uss };

  const ifr = assertOptionalScore(input.installerFeasibilityRating, "installerFeasibilityRating");
  if (isStructuredError(ifr)) return { ok: false, error: ifr };

  const p30 = assertOptionalScore(input.plantSurvivalRate30d, "plantSurvivalRate30d");
  if (isStructuredError(p30)) return { ok: false, error: p30 };

  const p90 = assertOptionalScore(input.plantSurvivalRate90d, "plantSurvivalRate90d");
  if (isStructuredError(p90)) return { ok: false, error: p90 };

  const mas = assertOptionalScore(input.maintenanceAdherenceScore, "maintenanceAdherenceScore");
  if (isStructuredError(mas)) return { ok: false, error: mas };

  const ac = assertInr(input.actualInstallCostInr, "actualInstallCostInr");
  if (isStructuredError(ac)) return { ok: false, error: ac };

  const am = assertInr(input.actualMaintenancePlanInr, "actualMaintenancePlanInr");
  if (isStructuredError(am)) return { ok: false, error: am };

  const mtc = assertTempDelta(input.measuredTempChangeC, "measuredTempChangeC");
  if (isStructuredError(mtc)) return { ok: false, error: mtc };

  const msc = assertTempDelta(input.measuredSurfaceTempChangeC, "measuredSurfaceTempChangeC");
  if (isStructuredError(msc)) return { ok: false, error: msc };

  if (input.telemetrySessionId) {
    const s = await db.recommendationTelemetrySession.findUnique({
      where: { id: input.telemetrySessionId },
      select: { id: true, projectId: true },
    });
    if (!s) {
      return { ok: false, error: validationError("SESSION_NOT_FOUND", "telemetrySessionId invalid") };
    }
    if (s.projectId !== pid) {
      return { ok: false, error: validationError("PROJECT_MISMATCH", "session project mismatch") };
    }
  }

  if (input.selectedCandidateSnapshotId) {
    const snap = await db.recommendationCandidateSnapshot.findUnique({
      where: { id: input.selectedCandidateSnapshotId },
      include: { session: { select: { projectId: true } } },
    });
    if (!snap) {
      return { ok: false, error: validationError("SNAPSHOT_NOT_FOUND", "selectedCandidateSnapshotId invalid") };
    }
    if (snap.session.projectId !== pid) {
      return { ok: false, error: validationError("PROJECT_MISMATCH", "snapshot project mismatch") };
    }
  }

  const installDate =
    input.installDate === undefined || input.installDate === null || input.installDate === ""
      ? null
      : new Date(input.installDate);
  if (installDate && Number.isNaN(installDate.getTime())) {
    return { ok: false, error: validationError("INVALID_DATE", "installDate not parseable") };
  }

  try {
    const row = await db.installOutcomeRecord.create({
      data: {
        projectId: pid,
        userId: input.userId ?? null,
        telemetrySessionId: input.telemetrySessionId ?? null,
        selectedCandidateSnapshotId: input.selectedCandidateSnapshotId ?? null,
        installerId: input.installerId ?? null,
        installStatus: st,
        installDate,
        actualInstallCostInr: ac as number | null | undefined,
        actualMaintenancePlanInr: am as number | null | undefined,
        installedAreaSqft: input.installedAreaSqft ?? null,
        irrigationInstalled: input.irrigationInstalled ?? null,
        speciesInstalledJson:
          input.speciesInstalled !== undefined && input.speciesInstalled !== null
            ? JSON.stringify(input.speciesInstalled)
            : null,
        deviationsFromRecommendationJson:
          input.deviationsFromRecommendation !== undefined && input.deviationsFromRecommendation !== null
            ? JSON.stringify(input.deviationsFromRecommendation)
            : null,
        userSatisfactionScore: uss as number | null | undefined,
        installerFeasibilityRating: ifr as number | null | undefined,
        measuredTempChangeC: mtc as number | null | undefined,
        measuredSurfaceTempChangeC: msc as number | null | undefined,
        plantSurvivalRate30d: p30 as number | null | undefined,
        plantSurvivalRate90d: p90 as number | null | undefined,
        maintenanceAdherenceScore: mas as number | null | undefined,
        notes: input.notes ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });
    return {
      ok: true,
      installOutcomeId: row.id,
      idempotency: input.idempotencyKey
        ? { replayed: false, scope: "install_outcome" }
        : undefined,
    };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        error: validationError("DUPLICATE_OUTCOME", "idempotencyKey already used", {
          scope: "install_outcome",
          reason: "unique_violation",
          meta: e.meta,
        }),
      };
    }
    throw e;
  }
}
