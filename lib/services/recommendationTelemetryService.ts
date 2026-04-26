import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type {
  CreateRecommendationSessionInput,
  CreateSessionResult,
  StructuredError,
} from "@/lib/recommendationTelemetryTypes";
import {
  assertGeneratorSource,
  assertNonEmptyString,
  isStructuredError,
  validationError,
} from "@/lib/recommendationTelemetryValidation";

export async function createRecommendationSession(
  input: CreateRecommendationSessionInput,
): Promise<{ ok: true; data: CreateSessionResult } | { ok: false; error: StructuredError }> {
  if (input.idempotencyKey) {
    const existing = await db.recommendationTelemetrySession.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { candidateSnapshots: { select: { id: true, candidateRank: true } } },
    });
    if (existing) {
      const ordered = [...existing.candidateSnapshots].sort((a, b) => a.candidateRank - b.candidateRank);
      return {
        ok: true,
        data: {
          recommendationSessionId: existing.id,
          candidateSnapshotIds: ordered.map((c) => c.id),
          idempotency: {
            replayed: true,
            scope: "telemetry_session",
            via: "telemetry_session_key",
          },
        },
      };
    }
  }

  const pid = assertNonEmptyString(input.projectId, "projectId");
  if (isStructuredError(pid)) return { ok: false, error: pid };

  const gen = assertGeneratorSource(input.generatorSource);
  if (isStructuredError(gen)) return { ok: false, error: gen };

  const mv = assertNonEmptyString(input.modelVersion, "modelVersion");
  if (isStructuredError(mv)) return { ok: false, error: mv };

  const rv = assertNonEmptyString(input.rulesVersion, "rulesVersion");
  if (isStructuredError(rv)) return { ok: false, error: rv };

  if (!Array.isArray(input.candidates) || input.candidates.length === 0) {
    return { ok: false, error: validationError("INVALID_PAYLOAD", "candidates must be a non-empty array") };
  }

  if (input.totalCandidates !== input.candidates.length) {
    return {
      ok: false,
      error: validationError("COUNT_MISMATCH", "totalCandidates must match candidates.length", {
        totalCandidates: input.totalCandidates,
        len: input.candidates.length,
      }),
    };
  }

  for (const c of input.candidates) {
    if (!Number.isInteger(c.candidateRank) || c.candidateRank < 1) {
      return {
        ok: false,
        error: validationError("INVALID_RANK", "candidateRank must be a positive integer", { c }),
      };
    }
  }

  const ranks = new Set(input.candidates.map((c) => c.candidateRank));
  if (ranks.size !== input.candidates.length) {
    return { ok: false, error: validationError("DUPLICATE_RANK", "candidateRank values must be unique per session") };
  }

  try {
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const session = await tx.recommendationTelemetrySession.create({
        data: {
          projectId: pid,
          userId: input.userId ?? null,
          photoSessionId: input.photoSessionId ?? null,
          modelVersion: mv,
          rulesVersion: rv,
          generatorSource: gen,
          projectSnapshotJson: JSON.stringify(input.projectSnapshot ?? {}),
          environmentSnapshotJson: JSON.stringify(input.environmentSnapshot ?? {}),
          preferenceSnapshotJson: JSON.stringify(input.preferenceSnapshot ?? {}),
          totalCandidates: input.totalCandidates,
          latencyMs: Math.max(0, Math.floor(Number(input.latencyMs) || 0)),
          legacyRecommendationRunId: input.legacyRecommendationRunId ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });

      const ids: string[] = [];
      for (const c of [...input.candidates].sort((a, b) => a.candidateRank - b.candidateRank)) {
        const row = await tx.recommendationCandidateSnapshot.create({
          data: {
            sessionId: session.id,
            candidateRank: c.candidateRank,
            candidateScore: c.candidateScore ?? null,
            candidateSource: c.candidateSource,
            candidatePayloadJson: JSON.stringify(c.candidatePayload ?? {}),
            speciesPayloadJson: c.speciesPayload ? JSON.stringify(c.speciesPayload) : null,
            estimatedInstallCostInr: c.estimatedInstallCostInr ?? null,
            estimatedMaintenanceCostInr: c.estimatedMaintenanceCostInr ?? null,
            expectedTempReductionC: c.expectedTempReductionC ?? null,
            expectedSurfaceTempReductionC: c.expectedSurfaceTempReductionC ?? null,
            feasibilityScore: c.feasibilityScore ?? null,
            safetyScore: c.safetyScore ?? null,
            heatMitigationScore: c.heatMitigationScore ?? null,
            waterEfficiencyScore: c.waterEfficiencyScore ?? null,
            wasShownToUser: c.wasShownToUser ?? false,
          },
        });
        ids.push(row.id);
      }

      return { session, ids };
    });

    return {
      ok: true,
      data: {
        recommendationSessionId: result.session.id,
        candidateSnapshotIds: result.ids,
        idempotency: input.idempotencyKey
          ? { replayed: false, scope: "telemetry_session" }
          : undefined,
      },
    };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        error: validationError("IDEMPOTENCY_CONFLICT", "Duplicate idempotency or unique constraint", {
          meta: e.meta,
        }),
      };
    }
    throw e;
  }
}
