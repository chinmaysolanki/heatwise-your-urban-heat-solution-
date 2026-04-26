import { db } from "@/lib/db";
import { stableRequestHash } from "@/lib/httpIdempotency";
import type { IdempotencyExecutionMeta, StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import {
  assertIdempotencyPolicy,
  completeIdempotencyRecord,
  releaseIdempotencyReservation,
  reserveIdempotencyKey,
} from "@/lib/services/idempotencyService";
import { assertMatchVsMismatch, assertMismatchReasonCodes } from "@/lib/verifiedOutcomesValidation";

const CONFIDENCE_TIERS = new Set(["low", "medium", "high", "gold"]);

export type SubmitVerifiedInstallInput = {
  /** Optional; duplicate POSTs with the same key replay the same `verifiedInstallId`. */
  idempotencyKey?: string | null;
  installJobId: string;
  installedSolutionType: string;
  installedAreaSqft: number;
  installedPlanterType: string;
  installedIrrigationType: string;
  installedShadeSolution: string;
  installedSpecies: unknown;
  installedMaterials: unknown;
  installedLayout?: Record<string, unknown> | null;
  matchesRecommendedCandidate: boolean;
  mismatchReasonCodes: string[];
  installerConfidenceScore: number;
  evidencePhotoRefs?: unknown;
  notes?: string | null;
};

type VerifiedInstallOk = { ok: true; verifiedInstallId: string; idempotency?: IdempotencyExecutionMeta };

export async function submitVerifiedInstall(
  input: SubmitVerifiedInstallInput,
): Promise<VerifiedInstallOk | { ok: false; error: StructuredError }> {
  const idemKey = input.idempotencyKey?.trim() || null;
  let recordId: string | null = null;

  const job = await db.installerInstallJob.findUnique({ where: { id: input.installJobId } });
  if (!job) return { ok: false, error: validationError("NOT_FOUND", "install job not found") };
  if (job.jobStatus !== "completed" && job.jobStatus !== "in_progress") {
    return { ok: false, error: validationError("JOB_NOT_READY", "job must be in_progress or completed") };
  }

  const existing = await db.verifiedInstallRecord.findUnique({ where: { installJobId: input.installJobId } });
  if (existing) {
    return {
      ok: true,
      verifiedInstallId: existing.id,
      idempotency: { replayed: true, scope: "install_submission", via: "verified_install_job_natural" },
    };
  }

  if (idemKey) {
    const pol = assertIdempotencyPolicy({
      scope: "install_submission",
      idempotencyKey: idemKey,
      policy: "optional",
    });
    if (!pol.ok) return { ok: false, error: pol.error };
    const hashPayload = { ...input };
    delete (hashPayload as { idempotencyKey?: string }).idempotencyKey;
    const r = await reserveIdempotencyKey("install_submission", idemKey, stableRequestHash(hashPayload));
    if (r.kind === "replay") {
      const b = r.body as { verifiedInstallId?: string };
      if (b?.verifiedInstallId) {
        return {
          ok: true,
          verifiedInstallId: b.verifiedInstallId,
          idempotency: { replayed: true, scope: "install_submission", via: "idempotency_store" },
        };
      }
      return { ok: false, error: validationError("INTERNAL_ERROR", "idempotency replay malformed") };
    }
    if (r.kind === "hash_conflict") {
      return {
        ok: false,
        error: validationError("IDEMPOTENCY_CONFLICT", "idempotency key reused with different body", {
          scope: "install_submission",
          reason: "hash_mismatch",
        }),
      };
    }
    if (r.kind === "in_flight") {
      return {
        ok: false,
        error: validationError("IDEMPOTENCY_IN_FLIGHT", "duplicate request in progress; retry later", {
          scope: "install_submission",
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

  const codesCheck = assertMismatchReasonCodes(input.mismatchReasonCodes);
  if ("code" in codesCheck) return fail(codesCheck);
  const mm = assertMatchVsMismatch(input.matchesRecommendedCandidate, codesCheck);
  if (mm) return fail(mm);

  if (input.installedAreaSqft <= 0 || input.installedAreaSqft > 1_000_000) {
    return fail(validationError("INVALID_AREA", "installed area out of range"));
  }
  if (input.installerConfidenceScore < 0 || input.installerConfidenceScore > 1) {
    return fail(validationError("INVALID_CONFIDENCE", "confidence must be 0..1"));
  }

  try {
    const row = await db.verifiedInstallRecord.create({
      data: {
        installJobId: input.installJobId,
        projectId: job.projectId,
        installerId: job.installerId,
        installedSolutionType: input.installedSolutionType,
        installedAreaSqft: input.installedAreaSqft,
        installedPlanterType: input.installedPlanterType,
        installedIrrigationType: input.installedIrrigationType,
        installedShadeSolution: input.installedShadeSolution,
        installedSpeciesJson: JSON.stringify(input.installedSpecies ?? []),
        installedMaterialsJson: JSON.stringify(input.installedMaterials ?? []),
        installedLayoutJson: input.installedLayout ? JSON.stringify(input.installedLayout) : null,
        matchesRecommendedCandidate: input.matchesRecommendedCandidate,
        mismatchReasonCodesJson: JSON.stringify(codesCheck),
        installerConfidenceScore: input.installerConfidenceScore,
        evidencePhotoRefsJson: input.evidencePhotoRefs ? JSON.stringify(input.evidencePhotoRefs) : null,
        notes: input.notes ?? null,
      },
    });

    if (recordId) await completeIdempotencyRecord(recordId, 201, { verifiedInstallId: row.id });
    return {
      ok: true,
      verifiedInstallId: row.id,
      idempotency: idemKey ? { replayed: false, scope: "install_submission" } : undefined,
    };
  } catch (e) {
    if (recordId) await releaseIdempotencyReservation(recordId);
    throw e;
  }
}

export type SubmitOutcomeVerificationInput = {
  verifiedInstallId: string;
  projectId: string;
  /** Optional client key; replays return the same `outcomeVerificationId`. */
  idempotencyKey?: string | null;
  verifiedByType: "user" | "installer" | "ops" | "sensor_feed" | "third_party_audit";
  verifiedById?: string | null;
  verificationWindowDays: number;
  measuredTempChangeC?: number | null;
  measuredSurfaceTempChangeC?: number | null;
  userSatisfactionScore?: number | null;
  installerFeasibilityRating?: number | null;
  plantSurvivalRate30d?: number | null;
  plantSurvivalRate90d?: number | null;
  maintenanceAdherenceScore?: number | null;
  waterUseAssessment?: number | null;
  shadingEffectivenessScore?: number | null;
  biodiversityObservationScore?: number | null;
  verificationConfidenceTier: string;
  evidenceRefs?: unknown;
  notes?: string | null;
};

type OutcomeVerificationOk = {
  ok: true;
  outcomeVerificationId: string;
  idempotency?: IdempotencyExecutionMeta;
};

export async function submitOutcomeVerification(
  input: SubmitOutcomeVerificationInput,
): Promise<OutcomeVerificationOk | { ok: false; error: StructuredError }> {
  const idemKey = input.idempotencyKey?.trim() || null;
  let recordId: string | null = null;

  if (idemKey) {
    const pol = assertIdempotencyPolicy({
      scope: "outcome_submission",
      idempotencyKey: idemKey,
      policy: "optional",
    });
    if (!pol.ok) return { ok: false, error: pol.error };
    const hashPayload = { ...input };
    delete (hashPayload as { idempotencyKey?: string }).idempotencyKey;
    const r = await reserveIdempotencyKey("outcome_submission", idemKey, stableRequestHash(hashPayload));
    if (r.kind === "replay") {
      const b = r.body as { outcomeVerificationId?: string };
      if (b?.outcomeVerificationId) {
        return {
          ok: true,
          outcomeVerificationId: b.outcomeVerificationId,
          idempotency: { replayed: true, scope: "outcome_submission", via: "idempotency_store" },
        };
      }
      return { ok: false, error: validationError("INTERNAL_ERROR", "idempotency replay malformed") };
    }
    if (r.kind === "hash_conflict") {
      return {
        ok: false,
        error: validationError("IDEMPOTENCY_CONFLICT", "idempotency key reused with different body", {
          scope: "outcome_submission",
          reason: "hash_mismatch",
        }),
      };
    }
    if (r.kind === "in_flight") {
      return {
        ok: false,
        error: validationError("IDEMPOTENCY_IN_FLIGHT", "duplicate request in progress; retry later", {
          scope: "outcome_submission",
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
    if (!CONFIDENCE_TIERS.has(input.verificationConfidenceTier)) {
      return fail(validationError("INVALID_TIER", "verification_confidence_tier invalid"));
    }
    if (input.verificationWindowDays < 1 || input.verificationWindowDays > 730) {
      return fail(validationError("INVALID_WINDOW", "verification_window_days out of range"));
    }

    const vi = await db.verifiedInstallRecord.findUnique({ where: { id: input.verifiedInstallId } });
    if (!vi || vi.projectId !== input.projectId) {
      return fail(validationError("VERIFIED_INSTALL_NOT_FOUND", "verified install invalid"));
    }

    const rate = (v: number | null | undefined, name: string) => {
      if (v == null) return null;
      if (v < 0 || v > 1) return validationError("INVALID_RANGE", `${name} must be 0..1`);
      return null;
    };
    for (const [k, v] of [
      ["plant_survival_rate_30d", input.plantSurvivalRate30d],
      ["plant_survival_rate_90d", input.plantSurvivalRate90d],
      ["maintenance_adherence_score", input.maintenanceAdherenceScore],
      ["water_use_assessment", input.waterUseAssessment],
      ["shading_effectiveness_score", input.shadingEffectivenessScore],
      ["biodiversity_observation_score", input.biodiversityObservationScore],
    ] as const) {
      const e = rate(v, k);
      if (e) return fail(e);
    }

    const sat = (v: number | null | undefined, name: string) => {
      if (v == null) return null;
      if (v < 0 || v > 5) return validationError("INVALID_RANGE", `${name} must be 0..5`);
      return null;
    };
    for (const [k, v] of [
      ["user_satisfaction_score", input.userSatisfactionScore],
      ["installer_feasibility_rating", input.installerFeasibilityRating],
    ] as const) {
      const e = sat(v, k);
      if (e) return fail(e);
    }

    if (input.measuredTempChangeC != null && (input.measuredTempChangeC < -15 || input.measuredTempChangeC > 15)) {
      return fail(validationError("INVALID_TEMP", "measured_temp_change_c out of range"));
    }

    const row = await db.outcomeVerificationRecord.create({
      data: {
        verifiedInstallId: input.verifiedInstallId,
        projectId: input.projectId,
        verifiedByType: input.verifiedByType,
        verifiedById: input.verifiedById ?? null,
        verificationWindowDays: input.verificationWindowDays,
        measuredTempChangeC: input.measuredTempChangeC ?? null,
        measuredSurfaceTempChangeC: input.measuredSurfaceTempChangeC ?? null,
        userSatisfactionScore: input.userSatisfactionScore ?? null,
        installerFeasibilityRating: input.installerFeasibilityRating ?? null,
        plantSurvivalRate30d: input.plantSurvivalRate30d ?? null,
        plantSurvivalRate90d: input.plantSurvivalRate90d ?? null,
        maintenanceAdherenceScore: input.maintenanceAdherenceScore ?? null,
        waterUseAssessment: input.waterUseAssessment ?? null,
        shadingEffectivenessScore: input.shadingEffectivenessScore ?? null,
        biodiversityObservationScore: input.biodiversityObservationScore ?? null,
        verificationConfidenceTier: input.verificationConfidenceTier,
        evidenceRefsJson: input.evidenceRefs ? JSON.stringify(input.evidenceRefs) : null,
        notes: input.notes ?? null,
      },
    });

    if (recordId) await completeIdempotencyRecord(recordId, 201, { outcomeVerificationId: row.id });
    return {
      ok: true,
      outcomeVerificationId: row.id,
      idempotency: idemKey ? { replayed: false, scope: "outcome_submission" } : undefined,
    };
  } catch (e) {
    if (recordId) await releaseIdempotencyReservation(recordId);
    throw e;
  }
}
