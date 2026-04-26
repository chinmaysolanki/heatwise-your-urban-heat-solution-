/**
 * layoutToImage.ts
 * Maps a LayoutSchema (metre-space coordinates) into pixel-space
 * coordinates within a given image crop rectangle.
 *
 * Coordinate system:
 *   LayoutZone uses (x=width axis, y=length axis) in metres from top-left.
 *   We map x ∈ [0, canvasWidthM]  → px ∈ [cropLeft,  cropLeft + cropW]
 *           y ∈ [0, canvasLengthM] → py ∈ [cropTop,   cropTop  + cropH]
 *
 * No perspective transform is applied — the crop rectangle IS the floor plane.
 * For overhead / near-overhead rooftop photos this is accurate.
 * For oblique shots the user adjusts the crop to cover the visible floor polygon.
 */

/** Crop rect as fractions of the full display image (0–1 each). */
export interface CropFrac {
  x: number;  // left edge fraction
  y: number;  // top edge fraction
  w: number;  // width fraction
  h: number;  // height fraction
}

/** A zone projected into pixel space. */
export interface PixelZone {
  id:    string;
  type:  "plant" | "module" | "path" | "buffer" | "existing";
  label: string;
  /** Pixel coords within the full display image (not relative to crop). */
  px: number;
  py: number;
  pw: number;
  ph: number;
  /** CSS rgba color for overlay rendering. */
  fillColor:   string;
  strokeColor: string;
}

// ── Minimum LayoutZone shape expected from the schema ──────────
interface SchemaZone {
  id?:      string;
  type?:    string;
  label?:   string;
  x?:       number;
  y?:       number;
  widthM?:  number;
  lengthM?: number;
}

interface LayoutSchema {
  canvasWidthM?:   number;
  canvasLengthM?:  number;
  zones?:          SchemaZone[];
}

// ── Zone fill / stroke look-up ─────────────────────────────────
const ZONE_STYLE: Record<string, { fill: string; stroke: string }> = {
  plant:    { fill: "rgba(34,197,94,0.35)",  stroke: "rgba(34,197,94,0.80)"  },
  module:   { fill: "rgba(56,189,248,0.30)", stroke: "rgba(56,189,248,0.75)" },
  path:     { fill: "rgba(161,120,75,0.40)", stroke: "rgba(161,120,75,0.85)" },
  buffer:   { fill: "rgba(100,100,100,0.18)",stroke: "rgba(150,150,150,0.45)"},
  existing: { fill: "rgba(200,200,200,0.20)",stroke: "rgba(200,200,200,0.50)"},
};

function zoneStyle(type: string | undefined) {
  return ZONE_STYLE[type ?? "plant"] ?? ZONE_STYLE.plant;
}

/**
 * Project each zone from the layout schema into pixel coordinates.
 *
 * @param schema      The LayoutSchema from the recommendation engine.
 * @param crop        The garden crop rect as fractions of the display image.
 * @param displayW    Width of the displayed image in CSS pixels.
 * @param displayH    Height of the displayed image in CSS pixels.
 */
export function mapLayoutToPixels(
  schema:   LayoutSchema | null | undefined,
  crop:     CropFrac,
  displayW: number,
  displayH: number,
): PixelZone[] {
  if (!schema) return [];

  const schW = schema.canvasWidthM  ?? 6;
  const schH = schema.canvasLengthM ?? 7;
  const zones = schema.zones ?? [];

  // Pixel bounds of the crop in display space
  const cpx = crop.x * displayW;
  const cpy = crop.y * displayH;
  const cpw = crop.w * displayW;
  const cph = crop.h * displayH;

  return zones
    .filter(
      z =>
        z.x !== undefined &&
        z.y !== undefined &&
        z.widthM !== undefined &&
        z.lengthM !== undefined,
    )
    .map((z, i) => {
      const xFrac = z.x! / schW;
      const yFrac = z.y! / schH;
      const wFrac = z.widthM! / schW;
      const hFrac = z.lengthM! / schH;
      const style = zoneStyle(z.type);

      return {
        id:          z.id ?? `zone-${i}`,
        type:        (z.type as PixelZone["type"]) ?? "plant",
        label:       z.label ?? (z.type ?? "zone"),
        px:          cpx + xFrac * cpw,
        py:          cpy + yFrac * cph,
        pw:          wFrac * cpw,
        ph:          hFrac * cph,
        fillColor:   style.fill,
        strokeColor: style.stroke,
      };
    });
}

/**
 * Draw the zone overlay onto an existing canvas context.
 *
 * @param ctx        2D rendering context (canvas must already be sized).
 * @param zones      Output of mapLayoutToPixels().
 * @param crop       The same crop rect used for projection.
 * @param canvasW    Canvas CSS width in pixels.
 * @param canvasH    Canvas CSS height in pixels.
 */
export function drawZoneOverlay(
  ctx:     CanvasRenderingContext2D,
  zones:   PixelZone[],
  crop:    CropFrac,
  canvasW: number,
  canvasH: number,
): void {
  // Dim everything outside the crop
  ctx.fillStyle = "rgba(0,0,0,0.52)";
  ctx.fillRect(0, 0, canvasW, canvasH);
  // Clear crop area (reveal photo underneath)
  ctx.clearRect(
    crop.x * canvasW,
    crop.y * canvasH,
    crop.w * canvasW,
    crop.h * canvasH,
  );

  // Draw each zone
  for (const z of zones) {
    ctx.fillStyle = z.fillColor;
    ctx.fillRect(z.px, z.py, z.pw, z.ph);

    ctx.strokeStyle = z.strokeColor;
    ctx.lineWidth = 0.75;
    ctx.strokeRect(z.px + 0.5, z.py + 0.5, z.pw - 1, z.ph - 1);

    // Label inside zone if there's room
    if (z.pw > 44 && z.ph > 14) {
      ctx.fillStyle = "rgba(255,255,255,0.90)";
      ctx.font = "bold 8px 'DM Sans', sans-serif";
      ctx.fillText(z.label.toUpperCase(), z.px + 5, z.py + 12);
    }
  }

  // Crop frame border
  const cx = crop.x * canvasW;
  const cy = crop.y * canvasH;
  const cw = crop.w * canvasW;
  const ch = crop.h * canvasH;

  ctx.strokeStyle = "#38BDF8";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.strokeRect(cx, cy, cw, ch);

  // Corner drag handles (filled squares)
  const hS = 9;
  ctx.fillStyle = "#38BDF8";
  for (const [hx, hy] of [
    [cx - hS / 2, cy - hS / 2],
    [cx + cw - hS / 2, cy - hS / 2],
    [cx - hS / 2, cy + ch - hS / 2],
    [cx + cw - hS / 2, cy + ch - hS / 2],
  ] as [number, number][]) {
    ctx.fillRect(hx, hy, hS, hS);
  }

  // Edge-midpoint handles (smaller)
  ctx.fillStyle = "rgba(56,189,248,0.55)";
  const hSm = 6;
  for (const [hx, hy] of [
    [cx + cw / 2 - hSm / 2, cy - hSm / 2],
    [cx + cw / 2 - hSm / 2, cy + ch - hSm / 2],
    [cx - hSm / 2, cy + ch / 2 - hSm / 2],
    [cx + cw - hSm / 2, cy + ch / 2 - hSm / 2],
  ] as [number, number][]) {
    ctx.fillRect(hx, hy, hSm, hSm);
  }
}

/**
 * Build a black-and-white inpainting mask as a PNG data URL.
 *
 * White = transform (planted zones, open planting areas)
 * Black = preserve (paths, buffers, and everything outside the crop)
 *
 * @param zones      Output of mapLayoutToPixels().
 * @param crop       The selected crop rect.
 * @param maskSize   Output mask resolution (square). Default 1024.
 */
export function buildMaskDataUrl(
  zones:    PixelZone[],
  crop:     CropFrac,
  maskSize  = 1024,
): string {
  const canvas = document.createElement("canvas");
  canvas.width  = maskSize;
  canvas.height = maskSize;
  const ctx = canvas.getContext("2d")!;

  // Full black: preserve everything
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, maskSize, maskSize);

  // White: the entire crop region (will plant here)
  ctx.fillStyle = "white";
  ctx.fillRect(
    crop.x * maskSize,
    crop.y * maskSize,
    crop.w * maskSize,
    crop.h * maskSize,
  );

  // For any display-space pixel zone that is a path or buffer,
  // scale it back to mask-space and paint black (preserve).
  // The zones were computed at displayW × displayH, so we must
  // rescale to maskSize × maskSize.
  //
  // We don't know displayW/H here, but we can recompute from crop fractions:
  // zone.px = crop.x * displayW + (z.x / schW) * (crop.w * displayW)
  // → frac_in_display = zone.px / displayW
  // Since we can't invert without displayW, we store zone fractions differently.
  // Workaround: call buildMaskFromFractions() using raw schema (preferred).

  return canvas.toDataURL("image/png");
}

/**
 * Build inpainting mask directly from the raw layout schema — no display size needed.
 *
 * @param schema     The LayoutSchema (metre-space coordinates).
 * @param crop       The selected crop rect (fractions of original image).
 * @param maskSize   Output mask resolution. Default 1024.
 */
export function buildMaskFromSchema(
  schema:   LayoutSchema | null | undefined,
  crop:     CropFrac,
  maskSize  = 1024,
): string {
  const canvas = document.createElement("canvas");
  canvas.width  = maskSize;
  canvas.height = maskSize;
  const ctx = canvas.getContext("2d")!;

  // Full black — preserve everything by default
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, maskSize, maskSize);

  // White — entire crop region (garden floor)
  ctx.fillStyle = "white";
  ctx.fillRect(
    crop.x * maskSize,
    crop.y * maskSize,
    crop.w * maskSize,
    crop.h * maskSize,
  );

  // Carve out preserved zones (paths, buffers) back to black
  if (schema?.zones) {
    const schW = schema.canvasWidthM  ?? 6;
    const schH = schema.canvasLengthM ?? 7;
    const cropPx = crop.x * maskSize;
    const cropPy = crop.y * maskSize;
    const cropPw = crop.w * maskSize;
    const cropPh = crop.h * maskSize;

    for (const z of schema.zones) {
      if (z.type !== "path" && z.type !== "buffer") continue;
      if (z.x === undefined || z.y === undefined) continue;

      ctx.fillStyle = "black";
      ctx.fillRect(
        cropPx + (z.x! / schW) * cropPw,
        cropPy + (z.y! / schH) * cropPh,
        ((z.widthM  ?? 0) / schW) * cropPw,
        ((z.lengthM ?? 0) / schH) * cropPh,
      );
    }
  }

  return canvas.toDataURL("image/png");
}
