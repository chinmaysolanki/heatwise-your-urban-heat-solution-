import type {
  EnvironmentSnapshot,
  PhotoSession,
  RecommendationRun,
} from "@prisma/client";
import { environmentSnapshotToClientEnv } from "@/lib/photoSession/clientEnvironmentMapping";

export type PhotoSessionRestoreInclude = PhotoSession & {
  environmentSnapshot?: EnvironmentSnapshot | null;
  recommendationRuns?: Pick<RecommendationRun, "id" | "createdAt">[];
};

export type SessionContextJson = {
  projectMeta?: Record<string, unknown> | null;
  environment?: Record<string, unknown> | null;
};

export function parseSessionContextJson(raw: string | null | undefined): SessionContextJson {
  if (!raw || typeof raw !== "string") return {};
  try {
    const v = JSON.parse(raw) as SessionContextJson;
    if (!v || typeof v !== "object") return {};
    return v;
  } catch {
    return {};
  }
}

function mergeClientEnvironment(
  fromJson: Record<string, unknown> | null | undefined,
  fromSnapshot: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  const base = { ...(fromJson ?? {}) };
  const snap = fromSnapshot ?? {};
  for (const k of Object.keys(snap)) {
    if (snap[k] !== undefined && snap[k] !== null) {
      (base as Record<string, unknown>)[k] = snap[k];
    }
  }
  if (Object.keys(base).length === 0) return null;
  return base;
}

/**
 * Build resume fields for the main app: projectMeta, environment, latestRecommendationRunId.
 * Raw PhotoSession columns are left to the caller to spread.
 */
export function buildPhotoSessionRestoreFields(row: PhotoSessionRestoreInclude): {
  projectMeta: Record<string, unknown> | null;
  environment: Record<string, unknown> | null;
  latestRecommendationRunId: string | null;
  latestRecommendationRunCreatedAt: string | null;
} {
  const ctx = parseSessionContextJson(row.sessionContextJson);
  let envFromSnap: Record<string, unknown> | null = null;
  if (row.environmentSnapshot) {
    envFromSnap = environmentSnapshotToClientEnv(row.environmentSnapshot) as Record<string, unknown>;
  }
  const environment = mergeClientEnvironment(
    ctx.environment as Record<string, unknown> | null | undefined,
    envFromSnap,
  );
  const projectMeta =
    ctx.projectMeta && typeof ctx.projectMeta === "object" && Object.keys(ctx.projectMeta).length > 0
      ? (ctx.projectMeta as Record<string, unknown>)
      : null;
  const latest = row.recommendationRuns?.[0];
  return {
    projectMeta,
    environment,
    latestRecommendationRunId: latest?.id ?? null,
    latestRecommendationRunCreatedAt: latest?.createdAt
      ? new Date(latest.createdAt).toISOString()
      : null,
  };
}

/**
 * Single JSON payload for GET /api/photo-session/:id — backward compatible with raw row fields.
 */
export function photoSessionToRestoreResponse(row: PhotoSessionRestoreInclude): Record<string, unknown> {
  const restore = buildPhotoSessionRestoreFields(row);
  const { environmentSnapshot: _envS, recommendationRuns: _runs, ...sessionScalars } = row;
  return {
    ...sessionScalars,
    projectMeta: restore.projectMeta,
    environment: restore.environment,
    latestRecommendationRunId: restore.latestRecommendationRunId,
    latestRecommendationRunCreatedAt: restore.latestRecommendationRunCreatedAt,
  };
}
