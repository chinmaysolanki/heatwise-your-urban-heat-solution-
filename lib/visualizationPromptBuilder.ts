import type { LayoutSchema, ARSpatialMapping, HeatReductionSummary } from "@/models";

export interface CapturedPhotoMetadata {
  description?: string;
  widthPx?: number;
  heightPx?: number;
  mimeType?: string;
}

export interface VisualizationPromptInput {
  photo: CapturedPhotoMetadata | null;
  // Recommendation is intentionally loose: the API enriches it with extra fields
  // like heatReductionSummary that are not part of the core type.
  recommendation: any;
  layoutSchema: LayoutSchema;
  spatialMapping: ARSpatialMapping;
}

export interface VisualizationPromptObject {
  sceneSummary: string;
  layoutSummary: {
    layoutName: string;
    zones: string[];
    modules: string[];
    plants: string[];
  };
  anchorsSummary: string[];
  heatSummary?: string;
  safetyInstructions: string[];
}

export interface VisualizationPromptResult {
  object: VisualizationPromptObject;
  prompt: string;
}

export function buildVisualizationPrompt(input: VisualizationPromptInput): VisualizationPromptResult {
  const { photo, recommendation, layoutSchema, spatialMapping } = input;

  const layoutName =
    recommendation?.candidate?.template?.name ??
    recommendation?.explanation?.headline ??
    "HeatWise rooftop garden layout";

  const zones = (layoutSchema.zones ?? []).map((z) =>
    `${z.type} zone "${z.label}" at x=${z.x}, y=${z.y}, size ${z.widthM}x${z.lengthM}m`,
  );

  const modules = (layoutSchema.placedModules ?? []).map((m) =>
    `${m.quantity}x ${m.moduleName} at x=${m.x}, y=${m.y}, size ${m.widthM}x${m.lengthM}m`,
  );

  const plants = (layoutSchema.placedPlants ?? []).map((p) =>
    `${p.quantity}x ${p.plantName} cluster near zone ${p.zone}`,
  );

  const anchors = (spatialMapping.anchors ?? []).map((a) =>
    `${a.type} "${a.label}" at (${a.positionM.x},${a.positionM.y},${a.positionM.z})`,
  );

  const heat: HeatReductionSummary | undefined =
    recommendation?.heatReductionSummary ?? undefined;

  const heatSummary = heat
    ? `Target surface cooling approximately -${heat.estimatedDropC.toFixed(
        1,
      )}°C with plant coverage ${(heat.plantCoverageRatio * 100).toFixed(
        0,
      )}%, shade ${(heat.shadeCoverageRatio * 100).toFixed(
        0,
      )}%, reflective ${(heat.reflectiveCoverageRatio * 100).toFixed(
        0,
      )}%, confidence ${heat.confidence}.`
    : undefined;

  const sceneSummary =
    photo?.description ??
    "Captured photo of a real rooftop or balcony, showing the usable surface, parapet walls, and surrounding context.";

  const safetyInstructions = [
    "You MUST strictly follow the provided layout schema and anchors.",
    "Do NOT invent your own layout or add structures that are not implied by the schema.",
    "Only render plants, modules, and paths that are described by the layout and anchors.",
  ];

  const object: VisualizationPromptObject = {
    sceneSummary,
    layoutSummary: {
      layoutName,
      zones,
      modules,
      plants,
    },
    anchorsSummary: anchors,
    heatSummary,
    safetyInstructions,
  };

  const promptParts: string[] = [];

  promptParts.push(
    "You are generating a photorealistic rooftop or balcony garden visualization for the HeatWise app.",
  );
  promptParts.push(...safetyInstructions);
  promptParts.push("");
  promptParts.push(`Base scene: ${sceneSummary}`);
  promptParts.push("");
  promptParts.push(`Layout name: ${layoutName}.`);
  if (zones.length) {
    promptParts.push(`Zones: ${zones.slice(0, 12).join("; ")}.`);
  }
  if (modules.length) {
    promptParts.push(`Modules: ${modules.slice(0, 12).join("; ")}.`);
  }
  if (plants.length) {
    promptParts.push(`Plants: ${plants.slice(0, 12).join("; ")}.`);
  }
  if (anchors.length) {
    promptParts.push(`3D anchors: ${anchors.slice(0, 16).join("; ")}.`);
  }
  if (heatSummary) {
    promptParts.push(heatSummary);
  }
  promptParts.push(
    "Render the captured surface transformed into this exact layout, keeping the original camera perspective, horizon line, and building context.",
  );

  const prompt = promptParts.join(" ");

  return {
    object,
    prompt,
  };
}

