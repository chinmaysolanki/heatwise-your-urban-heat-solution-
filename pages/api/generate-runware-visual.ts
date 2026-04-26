/**
 * generate-runware-visual.ts
 *
 * Mode A (img2img): captured photo → imageUpload → imageUUID → FLUX Dev img2img
 *   Model: runware:101@1 (FLUX Dev) — Runware's primary img2img model
 *   Preserves space structure, adds recommended species as garden
 *
 * Mode B (text-to-image fallback): no photo → runware:100@1
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";

export const config = {
  api: { bodyParser: { sizeLimit: "12mb" } },
};

// ── Plant visuals ──────────────────────────────────────────────
const PLANT_VISUALS: Record<string, string> = {
  herb:       "bushy aromatic herb with bright-green leaflets",
  grass:      "tall swaying ornamental grass with golden-green blades",
  succulent:  "rosette succulent with thick waxy leaves",
  cactus:     "columnar cactus with ribbed sage-green skin",
  shrub:      "rounded leafy shrub with dense green foliage",
  foliage:    "tropical plant with broad glossy leaves",
  vegetable:  "vegetable plant with visible ripe fruits",
  ornamental: "flowering plant with vivid colourful blooms",
  perennial:  "clumping perennial with upright colourful flowers",
  creeper:    "ground-cover creeper forming dense green mat",
  climber:    "climbing vine with overlapping glossy leaves on trellis",
  tree:       "compact tree with dense rounded canopy",
  palm:       "ornamental palm with feathery arching fronds",
  bamboo:     "clumping bamboo with upright green culms",
  fern:       "arching shade fern with deep-green fronds",
};

const ZONE_LABELS: Record<string, string> = {
  perimeter:  "along the edges",
  center:     "in the center",
  north_wall: "against the back wall",
  south_wall: "along the front",
  east_wall:  "on the right side",
  west_wall:  "on the left side",
  container:  "in pots",
  corner:     "at the corners",
  path:       "beside the path",
};

type SessionMeta = {
  widthM?: number | null;
  lengthM?: number | null;
  areaM2?: number | null;
  floorLevel?: number | null;
  environment?: {
    spaceType?: string | null;
    sunExposure?: string | null;
    windLevel?: string | null;
    currentTempC?: number | null;
    locationLabel?: string | null;
  } | null;
};

type ScoredPlantEntry = {
  plant?: { name?: string; type?: string; heightM?: number };
  quantity?: number;
  placementZone?: string;
  relevanceScore?: number;
};

// ── Img2img prompt — focused on what to ADD to the existing space ──
function buildImg2ImgPrompt(plants: ScoredPlantEntry[], meta?: SessionMeta): string {
  const env      = meta?.environment ?? {};
  const wM       = meta?.widthM  ?? 5;
  const lM       = meta?.lengthM ?? 6;
  const areaM2   = meta?.areaM2  ?? Math.round(wM * lM);
  const spaceRaw = env.spaceType ?? "outdoor_rooftop";

  const spaceLabel =
    spaceRaw === "outdoor_balcony" ? "balcony" :
    spaceRaw === "outdoor_terrace" ? "terrace" :
    spaceRaw === "indoor"          ? "indoor space" :
    "rooftop";

  const sunRaw = (env.sunExposure ?? "full").toLowerCase();
  const light  =
    sunRaw === "shade"   ? "soft diffused light" :
    sunRaw === "partial" ? "dappled natural light" :
    "bright natural sunlight";

  const loc = env.locationLabel ? `in ${env.locationLabel}, ` : "";

  const sorted = [...plants]
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
    .slice(0, 8);

  const plantList = sorted
    .map(sp => {
      const p = sp?.plant;
      if (!p?.name) return null;
      const visual = PLANT_VISUALS[p.type ?? "herb"] ?? "lush green plant";
      const h      = typeof p.heightM === "number" ? ` (${Math.round(p.heightM * 100)} cm)` : "";
      const qty    = (sp.quantity ?? 1) > 1 ? ` ×${sp.quantity}` : "";
      const zone   = ZONE_LABELS[sp.placementZone ?? "perimeter"] ?? "";
      return `${p.name}${qty}${h} — ${visual}${zone ? ", " + zone : ""}`;
    })
    .filter(Boolean)
    .join("; ");

  return [
    `Photorealistic established ${spaceLabel} garden, ${loc}${light}.`,
    `Transform this space: keep ALL existing walls, floor, pillars, ceiling, doors, windows, and structural elements exactly unchanged.`,
    `Add lush plants and garden only on the floor surface: ${plantList || "mixed tropical herbs, ornamental grasses, and flowering shrubs"}.`,
    `Place plants in terracotta pots and low raised timber planters, ${areaM2} m² area (${wM.toFixed(1)} m × ${lM.toFixed(1)} m).`,
    `Realistic photography, mature plants (2-3 years), natural cast shadows, soil visible between plants, 8K sharp detail.`,
  ].join(" ");
}

// ── Text-to-image fallback ─────────────────────────────────────
function buildT2IPrompt(plants: ScoredPlantEntry[], meta?: SessionMeta): string {
  const env      = meta?.environment ?? {};
  const wM       = meta?.widthM  ?? 5;
  const lM       = meta?.lengthM ?? 6;
  const areaM2   = meta?.areaM2  ?? Math.round(wM * lM);
  const spaceRaw = env.spaceType ?? "outdoor_rooftop";
  const floor    = meta?.floorLevel ?? 1;

  const spaceLabel =
    spaceRaw === "outdoor_balcony" ? "balcony garden" :
    spaceRaw === "outdoor_terrace" ? "terrace garden" :
    spaceRaw === "indoor"          ? "indoor atrium garden" :
    "rooftop garden";

  const elevLabel = floor <= 1 ? "ground-level" : `${floor}th-floor`;
  const loc = env.locationLabel ? `in ${env.locationLabel}, ` : "";
  const sunRaw = (env.sunExposure ?? "full").toLowerCase();
  const light  =
    sunRaw === "shade"   ? "soft diffused shade" :
    sunRaw === "partial" ? "dappled sun and shadow" :
    "bright full sunlight, golden-hour warmth";

  const sorted = [...plants]
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
    .slice(0, 10);

  const plantLines = sorted
    .map(sp => {
      const p = sp?.plant;
      if (!p?.name) return null;
      const visual = PLANT_VISUALS[p.type ?? "herb"] ?? "lush green plant";
      const h      = typeof p.heightM === "number" ? `, ${Math.round(p.heightM * 100)} cm tall` : "";
      const qty    = (sp.quantity ?? 1) > 1 ? ` ×${sp.quantity}` : "";
      const zone   = ZONE_LABELS[sp.placementZone ?? "perimeter"] ?? "in the garden";
      return `• ${p.name}${qty}: ${visual}${h}, ${zone}`;
    })
    .filter(Boolean)
    .join(". ");

  return [
    `Professional photo of a lush ${elevLabel} ${spaceLabel}, ${loc}${light}.`,
    plantLines || "Dense mixed herbs, grasses, and ornamental shrubs.",
    `${areaM2} m² (${wM.toFixed(1)} × ${lM.toFixed(1)} m), timber planter beds along perimeter, stone-tile paths, terracotta pots, dark mulched soil.`,
    `Photorealistic landscape photography, mature plants, sharp focus, 8K quality.`,
  ].join(" ");
}

function buildNegativePrompt(): string {
  return "cartoon, illustration, painting, sketch, 3D render, CGI, blurry, watermark, text, logo, plastic plants, fake greenery, altered walls, changed architecture, removed structures, changed background, fantasy, oversized plants, oversaturated, low quality";
}

// ── Runware API ────────────────────────────────────────────────
interface RunwareUploadResponse {
  data?: Array<{ taskType?: string; taskUUID?: string; imageUUID?: string }>;
  errors?: Array<{ message: string }>;
}

interface RunwareInferResponse {
  data?: Array<{ imageURL?: string }>;
  errors?: Array<{ message: string }>;
}

async function runwareRequest<T>(apiKey: string, tasks: unknown[]): Promise<T> {
  const res = await fetch("https://api.runware.ai/v1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(tasks),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Runware ${res.status}: ${text.slice(0, 400)}`);
  }

  const json = await res.json();
  if (json?.errors?.length) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join("; "));
  }
  if (json?.data?.[0]?.error) {
    throw new Error(json.data[0].message ?? json.data[0].error);
  }
  return json as T;
}

// ── Upload image → get imageUUID for seedImage ─────────────────
async function uploadImage(apiKey: string, dataUri: string): Promise<string> {
  const json = await runwareRequest<RunwareUploadResponse>(apiKey, [{
    taskType:  "imageUpload",
    taskUUID:  randomUUID(),
    image:     dataUri,  // full data URI: data:image/jpeg;base64,...
  }]);

  const imageUUID = json.data?.[0]?.imageUUID;
  if (!imageUUID) throw new Error("imageUpload returned no imageUUID");
  return imageUUID;
}

// ── Handler ────────────────────────────────────────────────────
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const apiKey = process.env.RUNWARE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ message: "RUNWARE_API_KEY is not configured" });
    return;
  }

  const { recommendation, scoredPlants: explicitPlants, sessionMeta, seedImage } = req.body ?? {};

  const scoredPlants: ScoredPlantEntry[] =
    (Array.isArray(explicitPlants) && explicitPlants.length > 0)
      ? explicitPlants
      : (recommendation?.candidate?.scoredPlants ?? recommendation?.scoredPlants ?? []);

  if (!scoredPlants.length && !recommendation) {
    res.status(400).json({ message: "Missing recommendation or scoredPlants" });
    return;
  }

  const hasPhoto = typeof seedImage === "string" && seedImage.startsWith("data:") && seedImage.length > 500;

  try {
    let imageURL: string | null = null;
    let mode = "generation";
    let prompt: string;

    if (hasPhoto) {
      // ── Mode A: img2img — upload image first, then run inference ──
      mode   = "img2img";
      prompt = buildImg2ImgPrompt(scoredPlants, sessionMeta ?? undefined);

      // Step 1: upload — strip data: prefix, send raw base64 only
      const base64Only = seedImage.replace(/^data:image\/\w+;base64,/, "");
      console.log("[runware] imageUpload, base64 length:", base64Only.length);

      let imageUUID: string | null = null;
      try {
        const uploadJson = await runwareRequest<RunwareUploadResponse>(apiKey, [{
          taskType: "imageUpload",
          taskUUID: randomUUID(),
          image:    base64Only,   // raw base64 without data: prefix
        }]);
        imageUUID = uploadJson.data?.[0]?.imageUUID ?? null;
      } catch (uploadErr) {
        console.warn("[runware] imageUpload failed, falling back to text-to-image:", uploadErr instanceof Error ? uploadErr.message : uploadErr);
      }

      if (imageUUID) {
        // Step 2: img2img inference using imageUUID as seedImage
        console.log("[runware] img2img inference, imageUUID:", imageUUID);
        const inferJson = await runwareRequest<RunwareInferResponse>(apiKey, [{
          taskType:       "imageInference",
          taskUUID:       randomUUID(),
          model:          "runware:101@1",
          positivePrompt: prompt,
          negativePrompt: buildNegativePrompt(),
          seedImage:      imageUUID,
          strength:       0.65,
          width:          1024,
          height:         1024,
          numberResults:  1,
          outputType:     ["URL"],
          outputFormat:   "WEBP",
          steps:          28,
          CFGScale:       3.5,
        }]);
        imageURL = inferJson.data?.[0]?.imageURL ?? null;
      } else {
        // Fallback: text-to-image with grounded prompt
        console.log("[runware] falling back to text-to-image after upload failure");
        mode   = "generation";
        prompt = buildT2IPrompt(scoredPlants, sessionMeta ?? undefined);
        const inferJson = await runwareRequest<RunwareInferResponse>(apiKey, [{
          taskType:       "imageInference",
          taskUUID:       randomUUID(),
          model:          "runware:100@1",
          positivePrompt: prompt,
          negativePrompt: buildNegativePrompt(),
          width:          1024,
          height:         1024,
          numberResults:  1,
          outputType:     ["URL"],
          outputFormat:   "WEBP",
          steps:          28,
          CFGScale:       7.5,
        }]);
        imageURL = inferJson.data?.[0]?.imageURL ?? null;
      }

    } else {
      // ── Mode B: text-to-image ──
      prompt = buildT2IPrompt(scoredPlants, sessionMeta ?? undefined);
      console.log("[runware] text-to-image with runware:100@1…");

      const inferJson = await runwareRequest<RunwareInferResponse>(apiKey, [{
        taskType:       "imageInference",
        taskUUID:       randomUUID(),
        model:          "runware:100@1",
        positivePrompt: prompt,
        negativePrompt: buildNegativePrompt(),
        width:          1024,
        height:         1024,
        numberResults:  1,
        outputType:     ["URL"],
        outputFormat:   "WEBP",
        steps:          28,
        CFGScale:       7.5,
      }]);

      imageURL = inferJson.data?.[0]?.imageURL ?? null;
    }

    if (!imageURL) {
      res.status(500).json({ message: "Runware returned no image URL" });
      return;
    }

    console.log("[runware] success:", imageURL.slice(0, 80));
    res.status(200).json({ imageUrl: imageURL, prompt: prompt.slice(0, 800), mode });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Runware generation failed";
    console.error("[runware] error:", message);
    res.status(500).json({ message });
  }
}
