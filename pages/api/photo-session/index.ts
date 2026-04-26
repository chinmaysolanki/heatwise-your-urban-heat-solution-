import type { NextApiRequest, NextApiResponse } from "next";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mapLayoutToSpatialAnchors } from "@/recommendation-engine";
import { parseSessionContextJson } from "@/lib/photoSession/photoSessionRestoreDto";
import { syncNormalizedEnvironmentForSession } from "@/lib/photoSession/syncNormalizedEnvironmentForSession";
import { isNonEmptyClientEnvironment } from "@/lib/photoSession/clientEnvironmentMapping";

function mustHaveSessionInProd(session: any, res: NextApiResponse): boolean {
  if (process.env.NODE_ENV === "production" && !session) {
    res.status(401).json({ message: "Unauthorized" });
    return false;
  }
  return true;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const session = await getServerSession(req, res, authOptions as any);
  if (!mustHaveSessionInProd(session, res)) return;
  const userId = (session as any)?.user?.id as string | undefined;

  if (req.method === "GET") {
    // List saved photo sessions (for SavedProjects)
    if (!userId) {
      res.status(200).json([]);
      return;
    }
    const sessions = await db.photoSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(
      sessions.map((s: any) => ({
        id: s.id,
        createdAt: s.createdAt,
        capturedAt: s.capturedAt,
        measurementStatus: s.measurementStatus,
        widthM: s.widthM,
        lengthM: s.lengthM,
        floorLevel: s.floorLevel,
        thumbnailUrl: s.visualizationImageUrl ?? null,
      })),
    );
    return;
  }

  if (req.method === "POST") {
    const { id, photoSession } = req.body ?? {};

    if (!photoSession) {
      res.status(400).json({ message: "Missing photoSession payload" });
      return;
    }

    const rec = photoSession.selectedRecommendation ?? null;
    const layoutSchema = rec?.layoutSchema ?? null;
    const spatialMapping =
      rec?.spatialMapping ??
      (layoutSchema ? mapLayoutToSpatialAnchors(layoutSchema, "top_left") : null);

    const prevCtx = id
      ? parseSessionContextJson(
          (
            await db.photoSession.findUnique({
              where: { id },
              select: { sessionContextJson: true },
            })
          )?.sessionContextJson,
        )
      : {};
    const nextMeta =
      photoSession.projectMeta != null ? photoSession.projectMeta : prevCtx.projectMeta ?? null;
    const nextEnv =
      photoSession.environment != null ? photoSession.environment : prevCtx.environment ?? null;

    let environmentSnapshotId: string | null | undefined;
    const shouldNormalizeEnv =
      typeof photoSession.projectId === "string" &&
      photoSession.projectId.length > 0 &&
      photoSession.environment != null &&
      isNonEmptyClientEnvironment(photoSession.environment);
    if (shouldNormalizeEnv) {
      const synced = await syncNormalizedEnvironmentForSession({
        projectId: photoSession.projectId as string,
        environment: photoSession.environment,
        widthM: photoSession.widthM,
        lengthM: photoSession.lengthM,
        floorLevel: photoSession.floorLevel,
      });
      if (synced) environmentSnapshotId = synced.environmentSnapshotId;
    }

    const data: Record<string, unknown> = {
      projectId:              photoSession.projectId ?? null,
      userId:                 userId ?? null,
      capturedAt:             photoSession.capturedAt ? new Date(photoSession.capturedAt) : null,
      photoData:              photoSession.capturedPhoto ?? null,
      photoMime:              "image/jpeg",
      photoWidth:             photoSession.photoWidth ?? null,
      photoHeight:            photoSession.photoHeight ?? null,
      measurementStatus:      photoSession.measurementStatus ?? null,
      widthM:                 photoSession.widthM ?? null,
      lengthM:                photoSession.lengthM ?? null,
      floorLevel:             photoSession.floorLevel ?? null,
      measurementCompletedAt: photoSession.measurementCompletedAt ? new Date(photoSession.measurementCompletedAt) : null,
      recommendationJson:     rec ? JSON.stringify(rec) : null,
      layoutSchema:           layoutSchema ? JSON.stringify(layoutSchema) : null,
      spatialMapping:         spatialMapping ? JSON.stringify(spatialMapping) : null,
      visualizationImageUrl:  photoSession.generatedVisualization?.imageUrl ?? null,
      visualizationPrompt:    photoSession.generatedVisualization?.prompt ?? null,
    };

    if (nextMeta != null || nextEnv != null) {
      (data as { sessionContextJson: string }).sessionContextJson = JSON.stringify({
        projectMeta: nextMeta,
        environment: nextEnv,
      });
    }
    if (environmentSnapshotId) {
      (data as { environmentSnapshotId: string }).environmentSnapshotId = environmentSnapshotId;
    }

    // If authenticated, enforce ownership on updates
    if (id && userId) {
      const owns = await db.photoSession.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!owns) {
        res.status(404).json({ message: "Not found" });
        return;
      }
    }

    const saved = id
      ? await db.photoSession.update({
          where: { id },
          data: data as Prisma.PhotoSessionUpdateInput,
        })
      : await db.photoSession.create({
          data: data as Prisma.PhotoSessionCreateInput,
        });

    res.status(200).json({ id: saved.id });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ message: "Method Not Allowed" });
}

