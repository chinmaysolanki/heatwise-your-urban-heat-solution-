/**
 * generate-runware-visual.ts  (OpenAI DALL-E 3 / gpt-image-1)
 *
 * Builds a full photographic scene brief for OpenAI so the generated image
 * faithfully reflects the user's actual space:
 *   • Area-based plant selection (tiny / small / medium / large / very-large)
 *   • Exact layout rules per tier (containers, raised beds, zones, paths)
 *   • Full scene context: floor, walls, light, camera angle, time-of-day
 *   • Per-plant placement with height, spread, and zone
 */

import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { toFile } from "openai";
import { Readable } from "stream";

export const config = {
  api: { bodyParser: { sizeLimit: "12mb" } },
  maxDuration: 60,
};

// ─── Types ─────────────────────────────────────────────────────────────────────
type SessionMeta = {
  widthM?:  number | null;
  lengthM?: number | null;
  areaM2?:  number | null;
  floorLevel?: number | null;
  environment?: {
    spaceType?:    string | null;
    sunExposure?:  string | null;
    windLevel?:    string | null;
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

// ─── Area tiers ────────────────────────────────────────────────────────────────
type AreaTier = "tiny" | "small" | "medium" | "large" | "xlarge";

function getAreaTier(areaM2: number): AreaTier {
  if (areaM2 <  6)  return "tiny";
  if (areaM2 < 20)  return "small";
  if (areaM2 < 50)  return "medium";
  if (areaM2 < 100) return "large";
  return "xlarge";
}

// ─── Area-tier rules ───────────────────────────────────────────────────────────
const TIER_RULES: Record<AreaTier, {
  label:       string;
  maxPlants:   number;
  plantNote:   string;
  layoutDesc:  string;
  planterDesc: string;
  cameraAngle: string;
}> = {
  tiny: {
    label:      "compact container garden",
    maxPlants:  4,
    plantNote:  "Only compact dwarf varieties under 40 cm spread. No large shrubs or trees. Prefer succulents, mini herbs, and trailing plants that fit in small pots.",
    layoutDesc: "All plants in individual terracotta pots and small ceramic containers arranged neatly. Vertical wall-mounted planter pockets on the boundary wall. No raised beds — only containers. Maximise vertical space.",
    planterDesc:"small terracotta pots (20–30 cm diameter), ceramic bowls, and vertical wall-pocket planters",
    cameraAngle:"eye-level close-up shot showing the full container arrangement against the boundary wall",
  },
  small: {
    label:      "container and raised-bed garden",
    maxPlants:  8,
    plantNote:  "Prefer compact herbs, dwarf shrubs, and ornamental grasses under 80 cm height and 50 cm spread. Avoid large canopy trees.",
    layoutDesc: "One narrow L-shaped raised timber planter (30 cm wide) running along two edges. Remaining plants in medium terracotta pots grouped in the centre. A small 40 cm wide gravel path along one side. No large structural elements.",
    planterDesc:"medium terracotta pots (30–40 cm), one timber raised bed 30 cm deep along two walls",
    cameraAngle:"wide-angle perspective shot from a slight elevation showing the full garden floor",
  },
  medium: {
    label:      "structured rooftop garden with defined zones",
    maxPlants:  12,
    plantNote:  "Mix of herbs, ornamental grasses, medium shrubs (up to 1.2 m), and one feature plant as a focal point. Avoid very large canopy trees.",
    layoutDesc: "Perimeter raised timber planter beds (40 cm wide, 35 cm deep) running along all four edges. A central stone-tile path (60 cm wide) cutting through the middle. Three grouped terracotta pot clusters at corners. A small trellis on the back wall with a climbing plant.",
    planterDesc:"perimeter raised timber beds 40 cm deep, large terracotta pots (45–55 cm), one trellis structure",
    cameraAngle:"elevated 45-degree perspective showing the full garden layout with all zones visible",
  },
  large: {
    label:      "multi-zone rooftop garden with seating",
    maxPlants:  16,
    plantNote:  "Include a mix of compact trees (up to 2 m), medium shrubs, ornamental grasses, herbs, and flowering plants. Create visual layers — tall background, medium midground, low foreground.",
    layoutDesc: "Four distinct zones: (1) productive herb and vegetable zone with deep raised beds along one wall, (2) ornamental flowering zone with curved planter beds, (3) gravel relaxation area with two wooden chairs, (4) feature tree zone with a single compact tree in a large planter. Wide stone-tile central path connecting all zones. Boundary walls with climbing plants.",
    planterDesc:"deep raised timber beds (50 cm), large decorative pots (60–80 cm), one oversized feature planter for tree",
    cameraAngle:"wide elevated overhead-angle shot (60 degrees) showing all four zones and the central pathway",
  },
  xlarge: {
    label:      "full-scale rooftop garden with multiple garden rooms",
    maxPlants:  20,
    plantNote:  "Full diversity — compact trees, tall ornamental grasses, flowering shrubs, groundcovers, climbers, herbs, and vegetables. Create a layered forest-garden feel with tall, medium and low plant levels.",
    layoutDesc: "Multiple garden rooms separated by low hedges: (1) kitchen garden with vegetable raised beds, (2) sensory herb garden, (3) shade garden under a pergola with a small ornamental tree, (4) wildflower meadow zone with ornamental grasses, (5) seating terrace with potted specimens. Wide stone paths, drip irrigation lines visible, boundary walls fully covered with climbers.",
    planterDesc:"deep wide raised beds, large specimen pots (80–100 cm), pergola structure, hedge dividers",
    cameraAngle:"high wide-angle elevated shot (70 degrees) capturing the full garden with all rooms visible",
  },
};

// ─── Plant visuals ─────────────────────────────────────────────────────────────
const PLANT_VISUAL: Record<string, string> = {
  herb:       "compact aromatic herb with bright-green leaflets and fine stems",
  grass:      "tall swaying ornamental grass with golden-green blades arching gracefully",
  succulent:  "rosette succulent with thick waxy blue-green leaves",
  cactus:     "columnar cactus with deep-ribbed sage-green skin and minimal spines",
  shrub:      "rounded dense shrub with layered dark-green foliage",
  foliage:    "tropical foliage plant with broad glossy deep-green leaves",
  vegetable:  "productive vegetable plant with visible ripening fruits or pods",
  ornamental: "flowering ornamental plant with vivid colourful blooms",
  perennial:  "clumping perennial with upright flower spikes in warm colours",
  creeper:    "low ground-cover creeper forming a dense bright-green carpet",
  climber:    "leafy climbing vine twining up a trellis with overlapping glossy leaves",
  tree:       "compact ornamental tree with a dense rounded canopy casting soft shadow",
  palm:       "slender ornamental palm with feathery arching fronds",
  bamboo:     "clumping bamboo with straight upright culms and delicate leaves",
  fern:       "arching shade fern with bright deep-green divided fronds",
};

const ZONE_POSITION: Record<string, string> = {
  perimeter:  "along the outer edge of the garden",
  center:     "in the centre of the space",
  north_wall: "against the far back wall",
  south_wall: "along the front edge",
  east_wall:  "on the right-side wall",
  west_wall:  "on the left-side wall",
  container:  "in a standalone decorative pot",
  corner:     "positioned at a corner as a focal accent",
  path:       "beside the main path as a border plant",
};

// ─── Area-aware plant filter ───────────────────────────────────────────────────
/**
 * Filters and annotates plants based on available area tier.
 * Small areas: prefer compact, low-spread, container-friendly plants.
 * Large areas: prefer feature plants, canopy layers, specimen trees.
 */
function filterPlantsForArea(plants: ScoredPlantEntry[], tier: AreaTier): ScoredPlantEntry[] {
  const sorted = [...plants].sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
  const rules  = TIER_RULES[tier];

  // For tiny/small: deprioritise trees, palms, bamboo (too large)
  // For large/xlarge: include them and boost feature plants
  const filtered = sorted.filter(sp => {
    const type = sp?.plant?.type ?? "herb";
    if (tier === "tiny"  && ["tree", "palm", "bamboo", "shrub"].includes(type)) return false;
    if (tier === "small" && ["tree", "palm", "bamboo"].includes(type)) return false;
    return true;
  });

  // If filtering removed too many, fall back to full sorted list
  const final = filtered.length >= 3 ? filtered : sorted;
  return final.slice(0, rules.maxPlants);
}

// ─── Build full scene brief for OpenAI ────────────────────────────────────────
function buildSceneBrief(
  plants: ScoredPlantEntry[],
  meta: SessionMeta,
  mode: "t2i" | "edit",
): string {
  const env      = meta?.environment ?? {};
  const wM       = meta?.widthM   ?? 4;
  const lM       = meta?.lengthM  ?? 5;
  const areaM2   = meta?.areaM2   ?? Math.round(wM * lM);
  const floor    = meta?.floorLevel ?? 1;
  const spaceRaw = env.spaceType ?? "outdoor_rooftop";
  const sunRaw   = (env.sunExposure ?? "full").toLowerCase();
  const windRaw  = (env.windLevel   ?? "medium").toLowerCase();
  const tempC    = env.currentTempC ?? null;
  const loc      = env.locationLabel ?? null;

  const tier  = getAreaTier(areaM2);
  const rules = TIER_RULES[tier];

  // ── Space label ────────────────────────────────────────────────
  const spaceLabel =
    spaceRaw === "outdoor_balcony" ? "balcony" :
    spaceRaw === "outdoor_terrace" ? "open terrace" :
    spaceRaw === "indoor"          ? "interior atrium" :
    "rooftop";
  const elevLabel =
    floor <= 0  ? "ground-floor" :
    floor === 1 ? "first-floor"  :
    floor === 2 ? "second-floor" :
    `${floor}th-floor`;

  // ── Lighting & time of day ─────────────────────────────────────
  const lightDesc =
    sunRaw === "shade"   ? "soft overcast diffused light, no harsh shadows, even cool illumination" :
    sunRaw === "partial" ? "warm morning sunlight partially filtered through a nearby building, dappled shadow patterns on the floor" :
    "bright golden-hour afternoon sunlight casting long soft shadows, warm colour temperature 5000K";

  const timeOfDay =
    sunRaw === "shade" ? "early morning, overcast sky" :
    sunRaw === "partial" ? "mid-morning, partly cloudy sky" :
    "late afternoon, clear sky with a golden sun low on the horizon";

  // ── Climate atmosphere ─────────────────────────────────────────
  const climateNote = tempC !== null
    ? tempC > 35 ? "hot tropical climate, lush moisture in the air, slight heat haze"
    : tempC > 25 ? "warm subtropical climate, clear air, vibrant plant colours"
    : "mild temperate climate, crisp air, rich green tones"
    : "";

  const windNote =
    windRaw === "high"  ? "plants show a gentle sway from a light breeze" :
    windRaw === "low"   ? "still air, leaves perfectly motionless" :
    "very subtle movement in taller plants, calm conditions";

  // ── Floor & wall materials ─────────────────────────────────────
  const floorMat =
    spaceRaw === "outdoor_balcony" ? "smooth grey concrete floor with anti-slip texture" :
    spaceRaw === "indoor"          ? "polished concrete floor with warm-tone tiles" :
    "light grey weathered concrete or rough stone-tile floor";

  const wallMat =
    spaceRaw === "indoor" ? "white painted interior walls with large windows" :
    "cream-painted boundary parapet walls, 90 cm high, with a small metal railing on top";

  // ── Select and describe each plant ────────────────────────────
  const selectedPlants = filterPlantsForArea(plants, tier);

  const plantLines = selectedPlants.map((sp, idx) => {
    const p       = sp?.plant;
    if (!p?.name) return null;
    const visual  = PLANT_VISUAL[p.type ?? "herb"] ?? "lush green plant";
    const hCm     = typeof p.heightM === "number" ? Math.round(p.heightM * 100) : null;
    const hDesc   = hCm ? `${hCm} cm tall` : "medium-height";
    const qty     = (sp.quantity ?? 1);
    const qDesc   = qty > 1 ? `${qty} specimens` : "one specimen";
    const zone    = ZONE_POSITION[sp.placementZone ?? "perimeter"] ?? "placed in the garden";
    const num     = idx + 1;
    return `  ${num}. ${p.name} (${qDesc}, ${hDesc}): ${visual}, ${zone}.`;
  }).filter(Boolean).join("\n");

  // ── Location context ───────────────────────────────────────────
  const locContext = loc
    ? `The garden is located in ${loc}. Reflect local architectural style and regional plant character where possible.`
    : "";

  // ── Layout instruction ─────────────────────────────────────────
  const layoutInstr = rules.layoutDesc;
  const planterInstr = rules.planterDesc;
  const cameraInstr  = rules.cameraAngle;

  // ── Full scene brief ───────────────────────────────────────────
  if (mode === "edit") {
    return `You are transforming a real photograph of a ${elevLabel} ${spaceLabel} into a photorealistic planted garden.

SPACE DIMENSIONS: ${wM.toFixed(1)} m wide × ${lM.toFixed(1)} m long = ${areaM2} m² total floor area.
GARDEN TIER: ${rules.label}.
${locContext}

STRICT INSTRUCTION: Keep ALL existing structural elements exactly as they are — walls, floor surface, ceiling, pillars, doors, windows, drainage pipes, railings. Only add plants and garden infrastructure on the floor and walls.

PLANT SELECTION RULES FOR THIS SPACE:
${rules.plantNote}

GARDEN LAYOUT TO APPLY:
${layoutInstr}
Use ${planterInstr}.

EXACT PLANTS TO PLACE (in order of prominence):
${plantLines || "  1. Mixed compact herbs and ornamental grasses in terracotta pots."}

LIGHTING: ${lightDesc}. Time of day: ${timeOfDay}.
CLIMATE: ${climateNote}. ${windNote}.
FLOOR: ${floorMat}. WALLS: ${wallMat}.

PHOTOGRAPHIC STYLE: Photorealistic DSLR photography, f/8, natural colour grading, 8K resolution, sharp focus throughout, no CGI or illustration look, no watermarks, no text overlays.`;
  }

  // text-to-image mode
  return `Generate a photorealistic photograph of a fully planted ${elevLabel} ${spaceLabel} garden.

SPACE: ${wM.toFixed(1)} m wide × ${lM.toFixed(1)} m long = ${areaM2} m² floor area. ${locContext}
GARDEN TIER: ${rules.label}.
FLOOR SURFACE: ${floorMat}.
BOUNDARY WALLS: ${wallMat}.
LIGHTING: ${lightDesc}. Time of day: ${timeOfDay}.
CLIMATE & ATMOSPHERE: ${climateNote}. ${windNote}.

PLANT SELECTION RULES FOR THIS SPACE:
${rules.plantNote}

GARDEN LAYOUT:
${layoutInstr}
Use ${planterInstr}.

EXACT PLANTS (placed exactly as described):
${plantLines || "  1. Mixed compact herbs, ornamental grasses, and succulents in terracotta pots."}

SKY: ${sunRaw === "shade" ? "overcast white sky visible above the parapet" : sunRaw === "partial" ? "partly cloudy blue sky with soft white clouds" : "clear warm blue sky with slight haze near the horizon"}.
BACKGROUND CONTEXT: ${spaceRaw === "indoor" ? "interior ceiling and structural beams visible above" : "surrounding building rooftops and city skyline softly blurred in the background"}.

PHOTOGRAPHIC STYLE: Shot on Canon EOS R5, 24mm wide-angle lens, f/8 aperture, ISO 100, natural light, professional landscape photography, 8K resolution, ultra-sharp, photorealistic, no CGI, no illustration, no watermarks, no text.
CAMERA ANGLE: ${cameraInstr}.`;
}

// ─── Convert base64 data URI → Buffer ─────────────────────────────────────────
function dataUriToBuffer(dataUri: string): { buffer: Buffer; mimeType: string } {
  const match = dataUri.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URI format");
  return { buffer: Buffer.from(match[2]!, "base64"), mimeType: match[1]! };
}

// ─── Handler ───────────────────────────────────────────────────────────────────
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

  const rawPlants: ScoredPlantEntry[] =
    (Array.isArray(explicitPlants) && explicitPlants.length > 0)
      ? explicitPlants
      : (recommendation?.candidate?.scoredPlants ?? recommendation?.scoredPlants ?? []);

  if (!rawPlants.length && !recommendation) {
    res.status(400).json({ message: "Missing recommendation or scoredPlants" });
    return;
  }

  const meta: SessionMeta = sessionMeta ?? {};
  const areaM2 = meta.areaM2 ?? Math.round((meta.widthM ?? 4) * (meta.lengthM ?? 5));
  const tier   = getAreaTier(areaM2);

  const openai   = new OpenAI({ apiKey });
  const hasPhoto = typeof seedImage === "string" && seedImage.startsWith("data:") && seedImage.length > 500;

  console.log(`[openai] area=${areaM2}m² tier=${tier} plants=${rawPlants.length} photo=${hasPhoto}`);

  try {
    let imageUrl: string | null = null;
    let finalPrompt: string;
    let mode = "generation";

    if (hasPhoto) {
      // ── Mode A: gpt-image-1 image edit (transform real photo) ──
      mode        = "img2img";
      finalPrompt = buildSceneBrief(rawPlants, meta, "edit");
      console.log("[openai] gpt-image-1 image edit, prompt length:", finalPrompt.length);

      try {
        const { buffer, mimeType } = dataUriToBuffer(seedImage);
        const ext       = mimeType === "image/png" ? "png" : "jpg";
        const imageFile = await toFile(Readable.from(buffer), `photo.${ext}`, { type: mimeType });

        const editRes = await openai.images.edit({
          model:  "gpt-image-1",
          image:  imageFile,
          prompt: finalPrompt,
          n:      1,
          size:   "1024x1024",
        } as Parameters<typeof openai.images.edit>[0]);

        const item = editRes.data?.[0];
        if (item?.url) {
          imageUrl = item.url;
        } else if ((item as any)?.b64_json) {
          imageUrl = `data:image/png;base64,${(item as any).b64_json}`;
        }
        console.log("[openai] gpt-image-1 edit success");
      } catch (editErr) {
        const msg = editErr instanceof Error ? editErr.message : String(editErr);
        console.warn("[openai] edit failed, falling back to DALL-E 3:", msg);
        mode        = "generation";
        finalPrompt = buildSceneBrief(rawPlants, meta, "t2i");
      }
    }

    if (!imageUrl) {
      // ── Mode B: DALL-E 3 text-to-image ─────────────────────────
      if (mode === "generation") {
        finalPrompt = buildSceneBrief(rawPlants, meta, "t2i");
      }
      console.log("[openai] DALL-E 3 text-to-image, tier:", tier);

      const genRes = await openai.images.generate({
        model:           "dall-e-3",
        prompt:          finalPrompt!,
        n:               1,
        size:            "1024x1024",
        quality:         "standard",
        response_format: "url",
      });

      imageUrl = genRes.data?.[0]?.url ?? null;
      const revised = genRes.data?.[0]?.revised_prompt;
      if (revised) finalPrompt = revised;
      console.log("[openai] DALL-E 3 success");
    }

    if (!imageUrl) {
      res.status(500).json({ message: "OpenAI returned no image" });
      return;
    }

    res.status(200).json({
      imageUrl,
      prompt: finalPrompt!.slice(0, 1000),
      mode,
      tier,
      areaM2,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    console.error("[openai] error:", message);
    res.status(500).json({ message });
  }
}
