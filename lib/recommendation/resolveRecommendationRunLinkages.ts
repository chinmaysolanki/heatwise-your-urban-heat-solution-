import { db } from "@/lib/db";

/**
 * Best-effort FKs for RecommendationRun from persisted photo session + project rows.
 * Never fabricates IDs; leaves fields null when nothing matches.
 */
export async function resolveRecommendationRunLinkages(params: {
  projectId?: string | null;
  photoSessionId?: string | null;
}): Promise<{
  spaceId: string | null;
  environmentSnapshotId: string | null;
  userPreferenceId: string | null;
}> {
  const { projectId, photoSessionId } = params;
  let spaceId: string | null = null;
  let environmentSnapshotId: string | null = null;

  if (photoSessionId) {
    const ps = await db.photoSession.findUnique({
      where: { id: photoSessionId },
      select: { environmentSnapshotId: true },
    });
    environmentSnapshotId = ps?.environmentSnapshotId ?? null;
    if (environmentSnapshotId) {
      const snap = await db.environmentSnapshot.findUnique({
        where: { id: environmentSnapshotId },
        select: { spaceId: true },
      });
      spaceId = snap?.spaceId ?? null;
    }
  }

  if (!spaceId && projectId) {
    const space = await db.space.findFirst({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    spaceId = space?.id ?? null;
  }

  let userPreferenceId: string | null = null;
  if (projectId) {
    const pref = await db.userPreference.findFirst({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    userPreferenceId = pref?.id ?? null;
  }

  return { spaceId, environmentSnapshotId, userPreferenceId };
}
