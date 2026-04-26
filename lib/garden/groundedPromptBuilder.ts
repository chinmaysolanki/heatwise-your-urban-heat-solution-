/**
 * groundedPromptBuilder.ts
 *
 * Builds a structured, data-grounded transformation prompt for Runware inpainting.
 * Every claim in the prompt is derived from real data:
 *   • actual species names + visual descriptions
 *   • actual layout zone sizes and labels from LayoutSchema
 *   • actual area dimensions
 *   • actual environment (sun, wind, temp, location)
 *   • actual space type and floor level
 *
 * This replaces the generic Runware prompt with one that:
 *   1. Explicitly instructs preservation of the original frame geometry
 *   2. References actual zones from the layout plan
 *   3. Names the specific species that should appear
 *   4. Respects walkway clearances
 *   5. Specifies the style the user selected
 */

// ── Minimal shape of the inputs ────────────────────────────────

interface SchemaZone {
  type?:    string;
  label?:   string;
  widthM?:  number;
  lengthM?: number;
}

interface LayoutSchemaLike {
  canvasWidthM?:  number;
  canvasLengthM?: number;
  zones?:         SchemaZone[];
}

interface ScoredPlantLike {
  plant?: {
    name?:    string;
    type?:    string;
    heightM?: number;
  };
  quantity?:      number;
  placementZone?: string;
  relevanceScore?: number;
}

interface EnvironmentLike {
  spaceType?:     string | null;
  sunExposure?:   string | null;
  windLevel?:     string | null;
  currentTempC?:  number | null;
  locationLabel?: string | null;
  heatExposure?:  string | null;
}

export interface GroundedPromptInput {
  layoutSchema?:  LayoutSchemaLike | null;
  scoredPlants:   ScoredPlantLike[];
  environment?:   EnvironmentLike | null;
  widthM?:        number | null;
  lengthM?:       number | null;
  floorLevel?:    number | null;
  styleChoice?:   "naturalistic" | "structured" | "tropical" | "minimal" | null;
  /** Does the seed image come from the user's actual captured photo? */
  hasSeedImage?:  boolean;
}

// ── Plant-type → visual description lookup ─────────────────────
const PLANT_VISUALS: Record<string, string> = {
  herb:       "dense bushy aromatic herb with vivid bright-green leaflets",
  grass:      "swaying ornamental grass clumps with fine golden-green blades",
  succulent:  "compact rosette succulents with thick waxy silver-green leaves",
  cactus:     "ribbed columnar cactus with muted sage-green skin and visible spines",
  shrub:      "rounded lush shrub with layered foliage and seasonal blooms",
  foliage:    "tropical foliage plant with broad bold glossy-green leaves",
  vegetable:  "productive vegetable with visible ripe fruits on green stems",
  ornamental: "flowering ornamental with vivid blooms in warm colour clusters",
  perennial:  "clumping perennial with warm-coloured flowers on upright stems",
  creeper:    "low ground-cover creeper forming a dense emerald-green mat",
  climber:    "lush climbing vine trained on timber trellis with overlapping glossy leaves",
  tree:       "compact columnar tree with a dense rounded canopy",
  palm:       "slender ornamental palm with feathery arching fronds",
  bamboo:     "clumping bamboo with upright culms and narrow lance-shaped leaves",
  fern:       "arching shade fern with pinnate fronds in deep emerald",
};

// ── Build the positive transformation prompt ───────────────────
export function buildGroundedPrompt(input: GroundedPromptInput): string {
  const {
    layoutSchema,
    scoredPlants,
    environment,
    widthM,
    lengthM,
    floorLevel,
    styleChoice,
    hasSeedImage = false,
  } = input;

  const wM  = widthM  ?? 6;
  const lM  = lengthM ?? 7;
  const aM2 = Math.round(wM * lM);

  // ── Space type ───────────────────────────────────────────────
  const spaceRaw   = environment?.spaceType ?? "outdoor_rooftop";
  const spaceLabel =
    spaceRaw === "outdoor_balcony" ? "balcony garden" :
    spaceRaw === "outdoor_terrace" ? "terrace garden" :
    spaceRaw === "indoor"          ? "indoor atrium garden" :
    "rooftop garden";

  // ── Elevation ────────────────────────────────────────────────
  const floor = floorLevel ?? 1;
  const elevLabel =
    floor <= 1  ? "ground-level" :
    floor <= 5  ? `${floor}th-floor elevated` :
    `high-rise floor-${floor}`;

  // ── Light & climate ──────────────────────────────────────────
  const sunRaw  = (environment?.sunExposure ?? "full").toLowerCase();
  const lightDesc =
    sunRaw === "shade"   ? "soft diffused shade, overcast even light" :
    sunRaw === "partial" ? "dappled sun-and-shadow, partial afternoon shade" :
    "bright full sun with crisp cast shadows, golden-hour warmth";

  const locStr  = environment?.locationLabel
    ? `in ${environment.locationLabel}, ` : "";
  const tempStr = typeof environment?.currentTempC === "number"
    ? `${Math.round(environment.currentTempC)}°C ambient, ` : "";

  // ── Style ────────────────────────────────────────────────────
  const styleDesc =
    styleChoice === "tropical"   ? "lush layered tropical canopy — overlapping foliage, dark mulch between trunks" :
    styleChoice === "minimal"    ? "clean Japanese-minimal — fine gravel, single accent plants, negative space" :
    styleChoice === "structured" ? "formal structured — clipped geometric beds, symmetry, standard-form trees" :
    "naturalistic cottage-garden — mixed informal beds, organic plant groupings, varied heights";

  // ── Layout from schema ────────────────────────────────────────
  const schema     = layoutSchema ?? null;
  const plantedZones = (schema?.zones ?? []).filter(
    z => z.type === "plant" || z.type === "module",
  );
  const pathZones    = (schema?.zones ?? []).filter(z => z.type === "path");

  let layoutBlock: string;
  if (plantedZones.length > 0) {
    const bedDescs = plantedZones.slice(0, 6).map(z => {
      const wCm = z.widthM  ? `${Math.round(z.widthM * 100)} cm wide` : "";
      const lCm = z.lengthM ? `${Math.round(z.lengthM * 100)} cm long` : "";
      const dims = [wCm, lCm].filter(Boolean).join(" × ");
      return `${z.label ?? z.type ?? "bed"}${dims ? ` (${dims})` : ""}`;
    }).join("; ");

    const pathDesc = pathZones.length > 0
      ? ` Walkways: ${
          pathZones.slice(0, 2).map(z => {
            const pCm = Math.min(z.widthM ?? 1, z.lengthM ?? 1);
            return `${z.label ?? "path"} (${Math.round(pCm * 100)} cm wide)`;
          }).join(", ")
        }.`
      : "";

    layoutBlock =
      `LAYOUT from design plan — planted beds: ${bedDescs}.` +
      pathDesc +
      ` Total floor area: ${aM2} m² (${wM.toFixed(1)} m × ${lM.toFixed(1)} m).` +
      ` Walkable clearance strictly preserved.`;
  } else {
    const bedD  = Math.round(Math.min(60, Math.max(25, wM * 5)));
    const pathW = Math.round(Math.min(90, Math.max(40, (wM + lM) * 3)));
    layoutBlock =
      `Garden dimensions: ${wM.toFixed(1)} m × ${lM.toFixed(1)} m (${aM2} m²).` +
      ` Raised planter beds (${bedD} cm deep) line the perimeter.` +
      ` Stone-tile paths (${pathW} cm wide) for walkability.`;
  }

  // ── Species block ─────────────────────────────────────────────
  const sorted = [...scoredPlants]
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
    .slice(0, 10);

  const plantLines = sorted
    .map(sp => {
      const p = sp?.plant;
      if (!p?.name) return null;
      const visual   = PLANT_VISUALS[p.type ?? "herb"] ?? "lush green plant";
      const hCm      = typeof p.heightM === "number"
        ? `, ${Math.round(p.heightM * 100)} cm tall` : "";
      const qty      = (sp.quantity ?? 1) > 1 ? ` ×${sp.quantity}` : "";
      const zone     = sp.placementZone
        ? ` — placed ${sp.placementZone.replace(/_/g, " ")}` : "";
      return `• ${p.name}${qty}: ${visual}${hCm}${zone}`;
    })
    .filter(Boolean)
    .join("\n");

  const speciesBlock = plantLines
    ? `EXACT SPECIES TO RENDER:\n${plantLines}`
    : "Lush mixed herbs, ornamental grasses, and flowering shrubs appropriate for the climate.";

  // ── Frame-preservation instruction ───────────────────────────
  const preserveInstr = hasSeedImage
    ? [
        "CRITICAL CONSTRAINT: Preserve the EXACT camera angle, perspective, and lens geometry of the source image.",
        "All fixed structures — parapet walls, railings, pillars, floors, adjacent buildings, rooftop equipment, sky, horizon — must remain pixel-perfect.",
        "Transform ONLY the plantable floor surface within the white mask region.",
        "Do NOT alter the sky, neighbouring buildings, or any structural element outside the mask.",
      ].join(" ")
    : "Compose the scene from a slight elevated perspective typical of rooftop / terrace photography. Architecture should look realistic and credible.";

  // ── Assemble ─────────────────────────────────────────────────
  return [
    `Transform this ${elevLabel} ${spaceLabel} ${locStr}${tempStr}into a photorealistic, professionally installed garden.`,
    "",
    preserveInstr,
    "",
    `STYLE: ${styleDesc}.`,
    `LIGHTING: ${lightDesc}.`,
    "",
    speciesBlock,
    "",
    layoutBlock,
    "",
    "VISUAL QUALITY: photorealistic professional landscape photography, natural plant variation and imperfections, realistic cast shadows at correct sun angle, established mature plants (2–3 years growth), individual leaves and soil textures clearly visible, moist darkened soil between plant bases, 8K sharpness throughout.",
    "",
    "OUTPUT must look like a real, installable, habitable garden — not CGI or fantasy. Maintain architectural integrity. Avoid symmetry that looks artificial.",
  ].join("\n");
}

// ── Negative prompt ────────────────────────────────────────────
export function buildGroundedNegativePrompt(): string {
  return [
    "cartoon, illustration, painting, sketch, 3D render, CGI, blurry",
    "watermark, text overlay, logo, signature",
    "plastic plants, artificial flowers, fake greenery, props",
    "studio background, white background, isolated plant",
    "distorted perspective, warped walls, changed architecture",
    "altered sky, different buildings, changed horizon, removed structures",
    "fantasy jungle, oversized plants, magical forest, impossible scale",
    "wrong scale, gigantic plants out of proportion",
    "dirty, broken, abandoned, overgrown weeds, neglected",
    "low quality, noisy, over-saturated, excessive HDR",
    "symmetrical, perfectly manicured, unnatural uniformity",
  ].join(", ");
}
