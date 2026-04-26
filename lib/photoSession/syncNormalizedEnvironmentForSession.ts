import { db } from "@/lib/db";
import {
  clientEnvironmentToSnapshotFields,
  isNonEmptyClientEnvironment,
  type ClientEnvironment,
} from "@/lib/photoSession/clientEnvironmentMapping";

export type SyncNormalizedEnvironmentInput = {
  projectId: string;
  environment: unknown;
  widthM?: number | null;
  lengthM?: number | null;
  floorLevel?: number | null;
};

export type SyncNormalizedEnvironmentResult = {
  environmentSnapshotId: string;
  spaceId: string;
} | null;

/**
 * Ensures a primary Space row and appends an EnvironmentSnapshot for this save.
 * Called from the photo-session POST hot path when project + environment are present.
 */
export async function syncNormalizedEnvironmentForSession(
  input: SyncNormalizedEnvironmentInput,
): Promise<SyncNormalizedEnvironmentResult> {
  const { projectId, environment, widthM, lengthM, floorLevel } = input;
  if (!isNonEmptyClientEnvironment(environment)) return null;

  const env = environment as ClientEnvironment;
  const fields = clientEnvironmentToSnapshotFields(env);

  let space = await db.space.findFirst({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  const area =
    typeof widthM === "number" &&
    typeof lengthM === "number" &&
    Number.isFinite(widthM) &&
    Number.isFinite(lengthM)
      ? widthM * lengthM
      : null;

  if (!space) {
    space = await db.space.create({
      data: {
        projectId,
        name: "Primary",
        label: "primary",
        lengthM: typeof lengthM === "number" ? lengthM : null,
        widthM: typeof widthM === "number" ? widthM : null,
        floorLevel: typeof floorLevel === "number" ? floorLevel : null,
        areaSqm: area,
        spaceKind: "ROOFTOP",
        indoor: false,
      },
    });
  } else {
    const update: Record<string, unknown> = {};
    if (typeof lengthM === "number" && Number.isFinite(lengthM)) update.lengthM = lengthM;
    if (typeof widthM === "number" && Number.isFinite(widthM)) update.widthM = widthM;
    if (typeof floorLevel === "number" && Number.isFinite(floorLevel)) update.floorLevel = floorLevel;
    if (area != null) update.areaSqm = area;
    if (Object.keys(update).length > 0) {
      space = await db.space.update({ where: { id: space.id }, data: update });
    }
  }

  const snapshot = await db.environmentSnapshot.create({
    data: {
      spaceId: space.id,
      tempC: fields.tempC,
      sunIndex: fields.sunIndex,
      windIndex: fields.windIndex,
      shadeLevel: fields.shadeLevel,
    },
  });

  return { environmentSnapshotId: snapshot.id, spaceId: space.id };
}
