import { createSpatialMappingFromRecommendation } from "@/ar";

function iso(v) {
  if (!v) return null;
  try {
    if (typeof v === "string") return v;
    if (typeof v.toISOString === "function") return v.toISOString();
  } catch {
    // ignore
  }
  return null;
}

export function buildInstallerExport({
  photoSession,
  selectedRecommendation,
  project = null,
  installationRequest = null,
  latestVisualization: latestVisualizationOverride = null,
}) {
  const rec =
    (photoSession && photoSession.selectedRecommendation) ||
    selectedRecommendation ||
    null;

  const layoutSchema =
    (rec && rec.layoutSchema) ||
    (photoSession && photoSession.layoutSchemaSnapshot) ||
    null;

  const spatialMapping =
    (rec && rec.spatialMapping) ||
    (photoSession && photoSession.spatialMappingSnapshot) ||
    (rec && rec.layoutSchema ? createSpatialMappingFromRecommendation(rec) : null);

  const latestVisualization =
    latestVisualizationOverride ??
    (photoSession && photoSession.generatedVisualization
      ? {
          imageUrl: photoSession.generatedVisualization.imageUrl ?? null,
          prompt: photoSession.generatedVisualization.prompt ?? "",
          createdAt: photoSession.generatedVisualization.createdAt ?? null,
        }
      : null);

  return {
    exportVersion: "1.1",
    exportedAt: new Date().toISOString(),
    project: {
      id: project?.id ?? photoSession?.projectId ?? null,
      name: project?.name ?? "HeatWise Scan",
      location: project?.location ?? "Unknown",
      surfaceType: project?.surfaceType ?? "rooftop",
      primaryGoal: project?.primaryGoal ?? "cooling",
      obstacles: project?.obstacles ?? "Unknown",
    },
    photoSession: {
      id: photoSession?.id ?? null,
      projectId: photoSession?.projectId ?? null,
      userId: photoSession?.userId ?? null,
      createdAt: iso(photoSession?.createdAt),
      updatedAt: iso(photoSession?.updatedAt),
      capturedAt: photoSession?.capturedAt ?? null,
      measurementStatus: photoSession?.measurementStatus ?? null,
      selectedCandidateId: photoSession?.selectedCandidateId ?? null,
    },
    capturedPhoto: {
      photoSessionId: photoSession?.id ?? null,
      capturedAt: photoSession?.capturedAt ?? null,
      mime: photoSession?.photoMime ?? "image/jpeg",
      widthPx: photoSession?.photoWidth ?? null,
      heightPx: photoSession?.photoHeight ?? null,
      hasInlineData: Boolean(photoSession?.photoData),
      inlineDataLength: typeof photoSession?.photoData === "string" ? photoSession.photoData.length : null,
    },
    measuredDimensions: {
      widthM: photoSession?.widthM ?? null,
      lengthM: photoSession?.lengthM ?? null,
      floorLevel: photoSession?.floorLevel ?? null,
      measurementCompletedAt: photoSession?.measurementCompletedAt ?? null,
      measurementStatus: photoSession?.measurementStatus ?? null,
    },
    selectedRecommendation: rec,
    layoutSchema,
    spatialMapping,
    latestVisualization,
    materialEstimate: rec?.candidate?.costEstimate ?? null,
    heatReductionSummary: rec?.heatReductionSummary ?? null,
    heatImpactSummary: project?.analysis
      ? {
          score: project.analysis.score ?? null,
          coolingDropC: project.analysis.coolingDrop ?? null,
          co2AnnualKg: project.analysis.co2Annual ?? null,
          energySavingKwh: project.analysis.energySaving ?? null,
          confidence: project.analysis.confidence ?? null,
          plants: project.analysis.plants ?? null,
          createdAt: iso(project.analysis.createdAt),
        }
      : null,
    installationRequest: installationRequest
      ? {
          id: installationRequest.id ?? null,
          projectId: installationRequest.projectId ?? null,
          contactName: installationRequest.contactName ?? null,
          email: installationRequest.email ?? null,
          phone: installationRequest.phone ?? null,
          contactMethod: installationRequest.contactMethod ?? null,
          timeline: installationRequest.timeline ?? null,
          createdAt: iso(installationRequest.createdAt),
        }
      : null,
  };
}

