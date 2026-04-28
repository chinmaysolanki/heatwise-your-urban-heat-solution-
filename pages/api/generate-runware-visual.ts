/**
 * generate-runware-visual.ts  (now powered by OpenAI)
 *
 * Mode A (img2img): captured photo present → gpt-image-1 edit (inpainting)
 *   Falls back to DALL-E 3 text-to-image if edit fails or gpt-image-1 unavailable.
 *
 * Mode B (text-to-image): no photo → DALL-E 3
 */

import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { toFile } from "openai";
import { Readable } from "stream";

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

function buildPlantList(plants: ScoredPlantEntry[], limit = 8): string {
  return [...plants]
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
    .slice(0, limit)
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
}

// ── DALL-E 3 text-to-image prompt ─────────────────────────────
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

  const plantList = buildPlantList(plants, 10);

  return [
    `Professional photograph of a lush ${elevLabel} ${spaceLabel}, ${loc}${light}.`,
    plantList
      ? `Featured plants: ${plantList}.`
      : "Dense mixed herbs, ornamental grasses, and flowering shrubs.",
    `${areaM2} m² space (${wM.toFixed(1)} × ${lM.toFixed(1)} m), timber planter beds along the perimeter, stone-tile paths, terracotta pots, dark mulched soil.`,
    `Photorealistic landscape photography, mature plants, natural cast shadows, sharp focus, 8K quality, no text, no watermarks.`,
  ].join(" ");
}

// ── Image-edit prompt (used when captured photo is supplied) ──
function buildEditPrompt(plants: ScoredPlantEntry[], meta?: SessionMeta): string {
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

  const loc = env.locationLabel ? `in ${env.locationLabel}, ` : "";
  const sunRaw = (env.sunExposure ?? "full").toLowerCase();
  const light  =
    sunRaw === "shade"   ? "soft diffused light" :
    sunRaw === "partial" ? "dappled natural light" :
    "bright natural sunlight";

  const plantList = buildPlantList(plants, 8);

  return [
    `Transform this ${spaceLabel}${loc ? " " + loc.replace(/, $/, "") : ""} into a photorealistic garden, ${light}.`,
    `Keep ALL existing walls, floor, pillars, ceiling, doors, windows, and structural elements exactly unchanged.`,
    `Add lush planted garden only on the floor: ${plantList || "mixed tropical herbs, ornamental grasses, and flowering shrubs"}.`,
    `Terracotta pots and low timber planters, ${areaM2} m² (${wM.toFixed(1)} m × ${lM.toFixed(1)} m).`,
    `Realistic photography, mature plants, natural shadows, 8K sharp detail, no text, no watermarks.`,
  ].join(" ");
}

/** Convert a base64 data URI to a Buffer */
function dataUriToBuffer(dataUri: string): { buffer: Buffer; mimeType: string } {
  const match = dataUri.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URI");
  return { buffer: Buffer.from(match[2]!, "base64"), mimeType: match[1]! };
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ message: "OPENAI_API_KEY is not configured" });
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

  const openai = new OpenAI({ apiKey });
  const hasPhoto = typeof seedImage === "string" && seedImage.startsWith("data:") && seedImage.length > 500;

  try {
    let imageUrl: string | null = null;
    let prompt: string;
    let mode = "generation";

    if (hasPhoto) {
      // ── Mode A: image edit with gpt-image-1 ──────────────────
      mode   = "img2img";
      prompt = buildEditPrompt(scoredPlants, sessionMeta ?? undefined);
      console.log("[openai] attempting gpt-image-1 image edit…");

      try {
        const { buffer, mimeType } = dataUriToBuffer(seedImage);
        const ext = mimeType === "image/png" ? "png" : "jpg";
        const imageFile = await toFile(Readable.from(buffer), `photo.${ext}`, { type: mimeType });

        const editRes = await openai.images.edit({
          model:  "gpt-image-1",
          image:  imageFile,
          prompt,
          n:      1,
          size:   "1024x1024",
        } as Parameters<typeof openai.images.edit>[0]);

        // gpt-image-1 returns base64 by default
        const item = editRes.data?.[0];
        if (item?.url) {
          imageUrl = item.url;
        } else if ((item as any)?.b64_json) {
          imageUrl = `data:image/png;base64,${(item as any).b64_json}`;
        }
        console.log("[openai] gpt-image-1 edit success");
      } catch (editErr) {
        const msg = editErr instanceof Error ? editErr.message : String(editErr);
        console.warn("[openai] image edit failed, falling back to DALL-E 3:", msg);
        // Fallback to DALL-E 3 text-to-image
        mode   = "generation";
        prompt = buildT2IPrompt(scoredPlants, sessionMeta ?? undefined);
      }
    }

    if (!imageUrl) {
      // ── Mode B: DALL-E 3 text-to-image ───────────────────────
      if (mode !== "img2img") {
        prompt = buildT2IPrompt(scoredPlants, sessionMeta ?? undefined);
      } else {
        prompt = buildT2IPrompt(scoredPlants, sessionMeta ?? undefined);
        mode = "generation";
      }
      console.log("[openai] DALL-E 3 text-to-image…");

      const genRes = await openai.images.generate({
        model:           "dall-e-3",
        prompt:          prompt!,
        n:               1,
        size:            "1024x1024",
        quality:         "hd",
        response_format: "url",
      });

      imageUrl = genRes.data?.[0]?.url ?? null;
      // Use the revised prompt from DALL-E 3 if available
      const revisedPrompt = genRes.data?.[0]?.revised_prompt;
      if (revisedPrompt) prompt = revisedPrompt;
      console.log("[openai] DALL-E 3 success");
    }

    if (!imageUrl) {
      res.status(500).json({ message: "OpenAI returned no image" });
      return;
    }

    res.status(200).json({ imageUrl, prompt: prompt!.slice(0, 800), mode });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    console.error("[openai] error:", message);
    res.status(500).json({ message });
  }
}
