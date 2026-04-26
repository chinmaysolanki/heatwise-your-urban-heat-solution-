import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildInstallerExport } from "@/lib/installerExport";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = await getServerSession(req, res, authOptions as any);
  if (!session) return res.status(401).json({ message: "Unauthorized" });

  const photoSessionId = String(req.query.photoSessionId ?? "");
  if (!photoSessionId) {
    return res.status(400).json({ message: "Missing photoSessionId" });
  }

  const s = await db.photoSession.findUnique({ where: { id: photoSessionId } });
  if (!s) return res.status(404).json({ message: "PhotoSession not found" });
  if (s.userId && (session as any)?.user?.id && s.userId !== (session as any).user.id) {
    return res.status(404).json({ message: "PhotoSession not found" });
  }

  const recommendation =
    s.recommendationJson ? (JSON.parse(s.recommendationJson) as any) : null;
  const layoutSchema = s.layoutSchema ? JSON.parse(s.layoutSchema) : null;
  const spatialMapping = s.spatialMapping ? JSON.parse(s.spatialMapping) : null;

  const latestViz = await db.visualizationRecord.findFirst({
    where: { photoSessionId: s.id },
    orderBy: { createdAt: "desc" },
  });

  const photoSession = {
    id: s.id,
    projectId: s.projectId ?? null,
    userId: s.userId ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    capturedAt: s.capturedAt ? s.capturedAt.toISOString() : null,
    photoData: s.photoData ?? null,
    photoMime: s.photoMime ?? null,
    photoWidth: s.photoWidth ?? null,
    photoHeight: s.photoHeight ?? null,
    measurementStatus: s.measurementStatus ?? null,
    widthM: s.widthM ?? null,
    lengthM: s.lengthM ?? null,
    floorLevel: s.floorLevel ?? null,
    measurementCompletedAt: s.measurementCompletedAt
      ? s.measurementCompletedAt.toISOString()
      : null,
    selectedCandidateId: s.selectedCandidateId ?? null,
    selectedRecommendation: recommendation,
    layoutSchemaSnapshot: layoutSchema,
    spatialMappingSnapshot: spatialMapping,
    generatedVisualization: s.visualizationImageUrl
      ? {
          imageUrl: s.visualizationImageUrl,
          prompt: s.visualizationPrompt ?? "",
          createdAt: s.updatedAt.toISOString(),
        }
      : null,
  };

  const project = s.projectId
    ? await db.project.findUnique({
        where: { id: s.projectId },
        include: { analysis: true, installationRequest: true },
      })
    : null;

  const exportObj = (buildInstallerExport as any)({
    photoSession,
    selectedRecommendation: recommendation,
    project,
    installationRequest: project?.installationRequest ?? null,
    latestVisualization: latestViz
      ? {
          imageUrl: latestViz.generatedImageUrl ?? null,
          prompt: latestViz.visualizationPrompt ?? "",
          createdAt: latestViz.createdAt.toISOString(),
          recommendationId: latestViz.recommendationId ?? null,
          generationVersion: latestViz.generationVersion ?? null,
        }
      : null,
  });

  return res.status(200).json(exportObj);
}

