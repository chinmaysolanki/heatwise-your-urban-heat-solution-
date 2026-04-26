import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { enrichTelemetryEventMetadata } from "@/lib/recommendationTelemetryCanonical";
import type { LogTelemetryEventInput, StructuredError } from "@/lib/recommendationTelemetryTypes";
import {
  assertEventType,
  assertNonEmptyString,
  isStructuredError,
  validationError,
  warnSelectWithoutCandidate,
} from "@/lib/recommendationTelemetryValidation";

function speciesCodesFromSpeciesPayloadJson(json: string | null | undefined): string[] | undefined {
  if (!json) return undefined;
  try {
    const o = JSON.parse(json) as unknown;
    if (typeof o !== "object" || o === null) return undefined;
    const c = (o as { speciesCatalogCodes?: unknown }).speciesCatalogCodes;
    if (!Array.isArray(c)) return undefined;
    const out = c.filter((x): x is string => typeof x === "string" && x.length > 0);
    return out.length ? out : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Append-only telemetry. Duplicate `feedbackEventId` returns 409-style error (caller maps to HTTP).
 */
export async function logTelemetryEvent(
  input: LogTelemetryEventInput,
): Promise<{ ok: true; eventId: string } | { ok: false; error: StructuredError }> {
  const fid = assertNonEmptyString(input.feedbackEventId, "feedbackEventId");
  if (isStructuredError(fid)) return { ok: false, error: fid };

  const sid = assertNonEmptyString(input.sessionId, "sessionId");
  if (isStructuredError(sid)) return { ok: false, error: sid };

  const pid = assertNonEmptyString(input.projectId, "projectId");
  if (isStructuredError(pid)) return { ok: false, error: pid };

  const es = assertNonEmptyString(input.eventSource, "eventSource");
  if (isStructuredError(es)) return { ok: false, error: es };

  const et = assertEventType(input.eventType);
  if (isStructuredError(et)) return { ok: false, error: et };

  const warn = warnSelectWithoutCandidate(et, input.candidateSnapshotId);
  if (warn) {
    /* non-fatal: still log; training pipelines can filter */
  }

  const session = await db.recommendationTelemetrySession.findUnique({
    where: { id: sid },
    select: { id: true, projectId: true, photoSessionId: true, legacyRecommendationRunId: true },
  });
  if (!session) {
    return { ok: false, error: validationError("SESSION_NOT_FOUND", "recommendation session does not exist") };
  }
  if (session.projectId !== pid) {
    return {
      ok: false,
      error: validationError("PROJECT_MISMATCH", "projectId does not match session.projectId"),
    };
  }

  let snapshotSpeciesJson: string | null = null;
  if (input.candidateSnapshotId) {
    const snap = await db.recommendationCandidateSnapshot.findFirst({
      where: { id: input.candidateSnapshotId, sessionId: sid },
      select: { id: true, speciesPayloadJson: true },
    });
    if (!snap) {
      return {
        ok: false,
        error: validationError("SNAPSHOT_NOT_FOUND", "candidateSnapshotId not in this session"),
      };
    }
    snapshotSpeciesJson = snap.speciesPayloadJson;
  }

  const ts =
    input.eventTimestamp === undefined || input.eventTimestamp === null
      ? new Date()
      : new Date(input.eventTimestamp);

  if (Number.isNaN(ts.getTime())) {
    return { ok: false, error: validationError("INVALID_TIMESTAMP", "eventTimestamp not parseable") };
  }

  const metaBase = input.metadata && typeof input.metadata === "object" ? { ...input.metadata } : {};
  const hasSpecies =
    Array.isArray(metaBase.speciesCatalogCodes) &&
    metaBase.speciesCatalogCodes.filter((x): x is string => typeof x === "string").length > 0;
  const codesFromSnap = speciesCodesFromSpeciesPayloadJson(snapshotSpeciesJson);
  const metadataForEnrich =
    !hasSpecies && codesFromSnap?.length ? { ...metaBase, speciesCatalogCodes: codesFromSnap } : metaBase;

  const enriched = enrichTelemetryEventMetadata(metadataForEnrich, {
    eventType: et,
    projectId: pid,
    sessionPhotoSessionId: session.photoSessionId,
    legacyRecommendationRunId: session.legacyRecommendationRunId,
    candidateSnapshotId: input.candidateSnapshotId ?? null,
    screenName: input.screenName ?? null,
    uiPosition: input.uiPosition ?? null,
  });

  const recommendationRunId =
    typeof enriched.recommendationRunId === "string" && enriched.recommendationRunId.length > 0
      ? enriched.recommendationRunId
      : null;

  try {
    const row = await db.recommendationTelemetryEvent.create({
      data: {
        feedbackEventId: fid,
        sessionId: sid,
        candidateSnapshotId: input.candidateSnapshotId ?? null,
        projectId: pid,
        userId: input.userId ?? null,
        eventType: et,
        eventTimestamp: ts,
        eventSource: es,
        screenName: input.screenName ?? null,
        uiPosition: input.uiPosition ?? null,
        dwellTimeMs: input.dwellTimeMs ?? null,
        eventValue: input.eventValue ?? null,
        metadataJson: JSON.stringify(enriched),
        recommendationRunId,
      },
    });
    return { ok: true, eventId: row.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        error: validationError("DUPLICATE_EVENT", "feedbackEventId already recorded (idempotent no-op)", {
          feedbackEventId: fid,
        }),
      };
    }
    throw e;
  }
}

export async function markCandidateShown(snapshotId: string): Promise<void> {
  await db.recommendationCandidateSnapshot.updateMany({
    where: { id: snapshotId },
    data: { wasShownToUser: true },
  });
}
