import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildInstallerExport } from "@/lib/installerExport";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ message: "Unauthorized" });

  const {
    projectId: rawProjectId,
    contactName,
    email,
    phone,
    contactMethod,
    timeline,
    installerExport,
  } = req.body ?? {};

  if (!contactName || !email || !contactMethod || !timeline) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // Ensure there is a Project row to satisfy the relation.
  let projectId = rawProjectId;
  if (!projectId) {
    const exportObj = installerExport ?? null;
    const dims = exportObj?.measuredDimensions ?? {};
    const w = typeof dims?.widthM === "number" ? dims.widthM : null;
    const l = typeof dims?.lengthM === "number" ? dims.lengthM : null;
    const area = w && l ? w * l : 0;

    const created = await db.project.create({
      data: {
        name: exportObj?.project?.name ?? "HeatWise Scan",
        location: exportObj?.project?.location ?? "Unknown",
        surfaceType: exportObj?.project?.surfaceType ?? "rooftop",
        primaryGoal: exportObj?.project?.primaryGoal ?? "cooling",
        area,
        obstacles: exportObj?.project?.obstacles ?? "Unknown",
        userId: session.user.id,
        status: "Draft",
      },
    });
    projectId = created.id;
  }

  // Persist an installer-ready export snapshot with every request.
  let exportObjToPersist = installerExport ?? null;

  if (!exportObjToPersist && projectId) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { analysis: true, installationRequest: true },
    });

    if (project?.userId && project.userId !== session.user.id) {
      return res.status(404).json({ message: "Project not found" });
    }

    const s = await db.photoSession.findFirst({
      where: { projectId, userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    });

    if (s) {
      const recommendation = s.recommendationJson ? JSON.parse(s.recommendationJson) : null;
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

      exportObjToPersist = buildInstallerExport({
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
    }
  }

  const exportJson = exportObjToPersist ? JSON.stringify(exportObjToPersist) : null;

  const entry = await db.installationRequest.create({
    data: {
      projectId,
      contactName,
      email,
      phone: phone || null,
      contactMethod,
      timeline,
      exportJson,
    },
  });

  return res.status(201).json(entry);
}

