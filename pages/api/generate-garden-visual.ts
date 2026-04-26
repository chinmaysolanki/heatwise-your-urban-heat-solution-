import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { db } from "@/lib/db";

// Allow large payloads — base64 JPEG from camera can reach 8–12 MB encoded
export const config = {
  api: { bodyParser: { sizeLimit: "20mb" } },
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Convert a base64 data URL to an OpenAI-compatible File ────────────────
async function dataUrlToOpenAIFile(dataUrl: string, filename: string) {
  const commaIdx = dataUrl.indexOf(",");
  const header   = commaIdx > 0 ? dataUrl.slice(0, commaIdx) : "";
  const base64   = commaIdx > 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const mime     = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
  const buffer   = Buffer.from(base64, "base64");
  return toFile(buffer, filename, { type: mime });
}

// Session-level metadata passed alongside the photo (no photo bytes duplicated)
type SessionMeta = {
  widthM?: number | null;
  lengthM?: number | null;
  floorLevel?: number | null;
  environment?: {
    spaceType?: string | null;
    sunExposure?: string | null;
    windLevel?: string | null;
    currentTempC?: number | null;
    heatExposure?: string | null;
    windExposure?: string | null;
    locationLabel?: string | null;
  } | null;
};

// Per-plant visual descriptors for the AI — height, canopy, colour, texture
const PLANT_TYPE_VISUAL: Record<string, string> = {
  succulent:  "compact rosette succulent, 15–25 cm tall, thick waxy silver-green leaves",
  grass:      "tall swaying ornamental grass, 60–90 cm, fine green-gold blades",
  herb:       "dense bushy herb, 30–50 cm, vivid bright-green leaflets",
  climber:    "lush climbing vine, 80–120 cm trained against wall, overlapping green leaves",
  shrub:      "rounded full shrub, 50–80 cm, layered dark-green foliage with seasonal blooms",
  foliage:    "tropical foliage plant, 70–100 cm, broad bold leaves in deep green",
  vegetable:  "productive vegetable plant, 40–70 cm, with visible red or yellow fruits and green stems",
  ornamental: "flowering ornamental, 30–60 cm, vivid blooms in orange, pink, or purple",
  perennial:  "clumping perennial, 40–70 cm, warm-coloured flowers on upright stems",
  creeper:    "low ground-cover creeper, 8–15 cm, dense mat of fine green leaves",
  tree:       "compact columnar tree, 150–200 cm, dense rounded canopy above main planting",
  palm:       "slender ornamental palm, 120–180 cm, feathery arching fronds",
  bamboo:     "clumping bamboo, 100–150 cm, upright slender canes with narrow lance-shaped leaves",
  cactus:     "columnar cactus, 30–60 cm, ribbed green stem with subtle spines",
  fern:       "lush shade fern, 40–60 cm, arching pinnate fronds in deep emerald green",
};

// ── Build a spatially-precise garden-transformation prompt ────────────────
function buildGardenEditPrompt(
  recommendation: any,
  spatialMapping: any,
  sessionMeta?: SessionMeta,
): string {
  const schema        = recommendation?.layoutSchema ?? {};
  const zones: any[]  = schema.zones ?? [];
  const placedModules: any[] = schema.placedModules ?? [];
  const scoredPlants: any[]  = recommendation?.candidate?.scoredPlants ?? [];
  const heat = recommendation?.heatReductionSummary;
  const env  = sessionMeta?.environment ?? {};

  // ── Spatial context ──────────────────────────────────────────────────────
  const widthM   = sessionMeta?.widthM   ?? 6;
  const lengthM  = sessionMeta?.lengthM  ?? 7;
  const floorLevel = sessionMeta?.floorLevel ?? 1;
  const areaM2   = (widthM * lengthM).toFixed(0);

  const spaceTypeRaw = env.spaceType ?? "outdoor_rooftop";
  const spaceLabel =
    spaceTypeRaw === "outdoor_balcony"  ? "balcony" :
    spaceTypeRaw === "outdoor_terrace"  ? "terrace" :
    spaceTypeRaw === "semi_outdoor"     ? "semi-covered terrace" :
    spaceTypeRaw === "indoor"           ? "indoor rooftop atrium" : "rooftop";

  // ── Environment context ──────────────────────────────────────────────────
  const sunRaw  = (env.sunExposure ?? "full").toLowerCase();
  const sunLabel =
    sunRaw === "shade" ? "heavily shaded" :
    sunRaw === "partial" ? "partially sunny" : "full sun exposure";
  const windRaw = (env.windLevel ?? "medium").toLowerCase();
  const windLabel =
    windRaw === "low" ? "sheltered from wind" :
    windRaw === "high" ? "exposed to strong wind" : "moderate wind conditions";
  const tempLabel = typeof env.currentTempC === "number"
    ? `ambient temperature ${Math.round(env.currentTempC)}°C`
    : "";
  const heatLabel = env.heatExposure
    ? `${env.heatExposure} heat zone`
    : "";
  const locationLabel = env.locationLabel ? `Location: ${env.locationLabel}.` : "";
  const floorLabel =
    floorLevel <= 1 ? "ground level" :
    floorLevel <= 4 ? `floor ${floorLevel} — moderate elevation` :
    `floor ${floorLevel} — high-rise elevation`;

  const envParts = [sunLabel, windLabel, tempLabel, heatLabel].filter(Boolean);

  // ── Coverage targets ──────────────────────────────────────────────────────
  const coveragePct = heat ? Math.round((heat.plantCoverageRatio ?? 0.55) * 100) : 55;
  const shadePct    = heat ? Math.round((heat.shadeCoverageRatio  ?? 0.3 ) * 100) : 30;
  const dropC       = heat ? heat.estimatedDropC.toFixed(1) : "3–5";

  // ── Plant species lines ───────────────────────────────────────────────────
  const plantLines = scoredPlants
    .slice(0, 12)
    .map((sp: any, i: number) => {
      const p = sp?.plant;
      if (!p) return null;
      const visual = PLANT_TYPE_VISUAL[p.type ?? "herb"] ?? "green leafy plant, 40–60 cm";
      const heightNote = typeof p.heightM === "number"
        ? `, ~${(p.heightM * 100).toFixed(0)} cm tall` : "";
      const canopyNote = typeof p.canopyM === "number"
        ? `, canopy spread ~${(p.canopyM * 100).toFixed(0)} cm` : "";
      return `  ${i + 1}. ${p.name}: ${visual}${heightNote}${canopyNote}.`;
    })
    .filter(Boolean) as string[];

  // ── Zone layout ────────────────────────────────────────────────────────────
  const zoneLines = zones.slice(0, 8).map((z: any) => {
    const zW  = (z.widthM  ?? 1).toFixed(1);
    const zL  = (z.lengthM ?? 1).toFixed(1);
    const xPct = Math.round(((z.x ?? 0) / widthM)  * 100);
    const yPct = Math.round(((z.y ?? 0) / lengthM) * 100);
    return `  - ${z.label ?? z.type}: ${zW}×${zL}m planted area, starting ${xPct}% from left edge and ${yPct}% from near edge`;
  });

  // ── Installed infrastructure ───────────────────────────────────────────────
  const moduleLines = placedModules.slice(0, 8).map((m: any) => {
    const mW = (m.widthM  ?? 0.6).toFixed(1);
    const mL = (m.lengthM ?? 0.8).toFixed(1);
    return `  - ${m.quantity ?? 1}× ${m.moduleName} (${mW}×${mL}m) at position (${(m.x ?? 0).toFixed(1)}, ${(m.y ?? 0).toFixed(1)}) from corner`;
  });

  // ── Spatial anchor hints (top 6 zone anchors) ─────────────────────────────
  const anchorHints = (spatialMapping?.anchors ?? [])
    .filter((a: any) => a.type === "zone" || a.type === "module")
    .slice(0, 6)
    .map((a: any) => {
      const xPct = Math.round((a.positionM.x / widthM) * 100);
      const yPct = Math.round((a.positionM.y / lengthM) * 100);
      return `${a.label}: centre at ${xPct}% left, ${yPct}% depth`;
    });

  // ── Compose the final prompt ───────────────────────────────────────────────
  const lines: string[] = [];

  lines.push(
    `Transform this exact photograph into a photorealistic established rooftop garden.` +
    ` The space is a ${widthM.toFixed(1)} m × ${lengthM.toFixed(1)} m ${spaceLabel} (${areaM2} m² usable area, ${floorLabel}).` +
    (locationLabel ? ` ${locationLabel}` : ""),
  );

  lines.push(
    `STRICT CONSTRAINT: Preserve the IDENTICAL camera angle, perspective, lens geometry, parapet walls, railings, window sills, rooftop equipment, and all surrounding buildings visible in the original photo.` +
    ` Only modify the plantable surface — do NOT alter the sky, horizon line, or any structure outside the plantable area.`,
  );

  if (envParts.length > 0) {
    lines.push(`Environment: ${envParts.join(", ")}.`);
  }

  lines.push(
    `Target coverage: fill ${coveragePct}% of the ${spaceLabel} surface with dense realistic plants.` +
    ` ${shadePct}% of that area should provide visible shade canopy.` +
    ` This design achieves approximately −${dropC}°C surface cooling.`,
  );

  if (plantLines.length > 0) {
    lines.push(
      `Plant these exact species in planter boxes and raised beds across the surface:\n${plantLines.join("\n")}`,
    );
  }

  if (zoneLines.length > 0) {
    lines.push(
      `Layout zones across the ${widthM.toFixed(1)} × ${lengthM.toFixed(1)} m space:\n${zoneLines.join("\n")}`,
    );
  } else if (anchorHints.length > 0) {
    lines.push(`Spatial planting zones: ${anchorHints.join("; ")}.`);
  }

  if (moduleLines.length > 0) {
    lines.push(
      `Installed planters and infrastructure:\n${moduleLines.join("\n")}`,
    );
  } else {
    lines.push(
      `Infrastructure: rectangular timber-framed raised planter beds along all 4 perimeter edges (30–40 cm wide),` +
      ` 2–3 central raised beds (60 cm × 120 cm each), terracotta accent pots at corners,` +
      ` drip-irrigation tubing running between beds, 60–80 cm walking path connecting zones.`,
    );
  }

  lines.push(
    `Realism requirements: plants must look fully established (2–3 years growth), three-dimensional, and photorealistic.` +
    ` Sunlight direction and cast shadows must be consistent with the original photo's lighting angle.` +
    ` Show realistic soil in open planter tops (moisture-darkened edges), natural plant imperfections` +
    ` (slight growth variation, minor leaf curl), and visible mulch between plants.` +
    ` Do NOT generate uniformly perfect plants, studio lighting, fantasy species, or painterly textures.`,
  );

  lines.push(
    `The final result must look exactly like a real photograph taken from this same camera position` +
    ` after professional installation — not a render, not an illustration, not a mood board.`,
  );

  return lines.join("\n\n");
}

// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const { photo, recommendation, spatialMapping, photoSessionId, sessionMeta } = req.body ?? {};

  if (!photo || !recommendation || !recommendation.layoutSchema || !spatialMapping) {
    res.status(400).json({
      message: "Missing required fields: photo, recommendation.layoutSchema, spatialMapping",
    });
    return;
  }

  try {
    const editPrompt = buildGardenEditPrompt(recommendation, spatialMapping, sessionMeta ?? undefined);

    // Convert the captured AR frame (base64 data URL) to a File the API can consume
    const imageFile = await dataUrlToOpenAIFile(photo, "rooftop_scan.jpg");

    // Use images.edit — this transforms the ACTUAL photo into a garden
    const result = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt: editPrompt,
      n: 1,
      size: "1024x1024",
    } as any);

    // gpt-image-1 returns b64_json; fall back to url for other models
    const entry = (result as any).data?.[0];
    let imageUrl: string | null = null;
    if (entry?.b64_json) {
      imageUrl = `data:image/png;base64,${entry.b64_json}`;
    } else {
      imageUrl = entry?.url ?? null;
    }

    // Persist record (store truncated ref to avoid huge DB rows)
    if (photoSessionId) {
      const recommendationId =
        (recommendation as any).id ??
        recommendation?.candidate?.template?.id ??
        recommendation?.candidate?.template?.name ??
        "unknown-recommendation";

      const count = await db.visualizationRecord.count({ where: { photoSessionId } });

      await db.visualizationRecord.create({
        data: {
          photoSessionId,
          sourcePhotoRef: typeof photo === "string" ? photo.slice(0, 128) : null,
          recommendationId,
          layoutSchema:      JSON.stringify(recommendation.layoutSchema),
          spatialMapping:    JSON.stringify(spatialMapping),
          visualizationPrompt: editPrompt.slice(0, 2000),
          generatedImageUrl: imageUrl ? imageUrl.slice(0, 512) : null,
          generationVersion: count + 1,
        },
      });
    }

    res.status(200).json({ prompt: editPrompt.slice(0, 500), imageUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate visualization";
    res.status(500).json({ message });
  }
}
