// ============================================================
// HeatWise — AR Canvas Renderer
// src/utils/arCanvasRenderer.ts
//
// All drawing operations for the AR overlay canvas.
// Pure functions — take canvas + state, return nothing.
// No React, no state management.
//
// Render layers (bottom to top):
//   1. Guide grid
//   2. Quadrilateral fill
//   3. Edge lines
//   4. Corner markers
//   5. Dimension labels
//   6. Instructions
// ============================================================

import type { CornerSet, CornerID, ARSessionState } from "../types/ar.types";

// ─── Design Tokens ────────────────────────────────────────────

const COLORS = {
  gridLine:           "rgba(82,183,136,0.10)",    // forest green grid
  edgeLine:           "rgba(82,183,136,0.92)",    // healthy leaf
  edgeLineIncomplete: "rgba(82,183,136,0.32)",
  quadFill:           "rgba(82,183,136,0.10)",
  cornerIdle:         "rgba(216,243,220,0.55)",
  cornerPlaced:       "rgba(82,183,136,1)",       // #52B788
  cornerActive:       "rgba(249,199,79,1)",       // golden sunlight
  cornerRing:         "rgba(82,183,136,0.28)",
  cornerShadow:       "rgba(9,22,14,0.6)",
  labelBg:            "rgba(9,22,14,0.80)",
  labelText:          "#D8F3DC",
  dimensionText:      "rgba(82,183,136,1)",
  dimensionBg:        "rgba(9,22,14,0.85)",
  instructionBg:      "rgba(9,22,14,0.78)",
  instructionText:    "#D8F3DC",
  warningText:        "rgba(249,199,79,1)",       // golden warning
};

// ─── Public API ──────────────────────────────────────────────

export interface RenderState {
  corners:         CornerSet;
  placedCount:     number;
  activeCorner:    CornerID | null;
  sessionState:    ARSessionState;
  widthM:          number | null;
  lengthM:         number | null;
  skewWarning:     boolean;
}

/**
 * Main render function — call on every animation frame.
 * Clears the canvas and redraws the full AR overlay.
 */
export function renderAROverlay(
  canvas: HTMLCanvasElement,
  state:  RenderState,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Layer 1: guide grid (only while placing corners)
  if (state.sessionState === "placing_corners") {
    drawGuideGrid(ctx, canvas.width, canvas.height);
  }

  // Layer 2–3: quad fill and edges (once 2+ corners placed)
  if (state.placedCount >= 2) {
    drawQuadrilateral(ctx, state.corners, state.placedCount);
  }

  // Layer 4: corner markers
  drawCornerMarkers(ctx, state.corners, state.activeCorner);

  // Layer 5: dimension labels (once complete)
  if (state.placedCount === 4 && state.widthM && state.lengthM) {
    drawDimensionLabels(
      ctx, state.corners,
      state.widthM, state.lengthM,
      state.skewWarning,
    );
  }

  // Layer 6: instruction overlay
  drawInstructions(ctx, canvas.width, canvas.height, state);
}

// ─── Layer 1: Guide Grid ──────────────────────────────────────

function drawGuideGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  ctx.save();
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth   = 1;

  const cols = 6;
  const rows = 8;

  for (let i = 1; i < cols; i++) {
    const x = (w / cols) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  for (let i = 1; i < rows; i++) {
    const y = (h / rows) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Centre crosshair
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([4, 4]);

  ctx.beginPath();
  ctx.moveTo(w / 2 - 20, h / 2);
  ctx.lineTo(w / 2 + 20, h / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w / 2, h / 2 - 20);
  ctx.lineTo(w / 2, h / 2 + 20);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();
}

// ─── Layer 2–3: Quadrilateral ─────────────────────────────────

function drawQuadrilateral(
  ctx:          CanvasRenderingContext2D,
  corners:      CornerSet,
  placedCount:  number,
): void {
  const placed  = getPlacedCorners(corners);
  if (placed.length < 2) return;

  const isComplete = placedCount === 4;
  const ORDER: CornerID[] = ["tl", "tr", "br", "bl"];

  ctx.save();

  // Build the path from placed corners in order
  const orderedPlaced = ORDER.filter(id => corners[id].isPlaced)
                             .map(id => corners[id].screen);

  if (orderedPlaced.length < 2) { ctx.restore(); return; }

  // Fill (only when complete)
  if (isComplete) {
    ctx.beginPath();
    ctx.moveTo(orderedPlaced[0].x, orderedPlaced[0].y);
    orderedPlaced.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = COLORS.quadFill;
    ctx.fill();
  }

  // Edges
  ctx.strokeStyle = isComplete ? COLORS.edgeLine : COLORS.edgeLineIncomplete;
  ctx.lineWidth   = isComplete ? 2.5 : 1.5;
  ctx.setLineDash(isComplete ? [] : [6, 4]);
  ctx.lineJoin    = "round";

  ctx.beginPath();
  ctx.moveTo(orderedPlaced[0].x, orderedPlaced[0].y);
  orderedPlaced.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
  if (isComplete) ctx.closePath();
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();
}

// ─── Layer 4: Corner Markers ──────────────────────────────────

const CORNER_ORDER: CornerID[] = ["tl", "tr", "br", "bl"];
const CORNER_LABELS: Record<CornerID, string> = {
  tl: "Top-Left",
  tr: "Top-Right",
  br: "Bottom-Right",
  bl: "Bottom-Left",
};

function drawCornerMarkers(
  ctx:           CanvasRenderingContext2D,
  corners:       CornerSet,
  activeCorner:  CornerID | null,
): void {
  CORNER_ORDER.forEach((id, index) => {
    const corner   = corners[id];
    const isActive = id === activeCorner;
    const isPlaced = corner.isPlaced;

    ctx.save();

    if (isPlaced) {
      drawPlacedMarker(ctx, corner.screen.x, corner.screen.y, isActive, id);
    } else if (isActive) {
      drawActiveGuide(ctx, corner.screen.x, corner.screen.y, index);
    }

    ctx.restore();
  });
}

function drawPlacedMarker(
  ctx:      CanvasRenderingContext2D,
  x:        number,
  y:        number,
  isActive: boolean,
  id:       CornerID,
): void {
  const RADIUS = 16;

  // Shadow
  ctx.shadowColor   = COLORS.cornerShadow;
  ctx.shadowBlur    = 8;

  // Outer ring (pulsing effect for active)
  if (isActive) {
    ctx.beginPath();
    ctx.arc(x, y, RADIUS + 8, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.cornerRing;
    ctx.lineWidth   = 2;
    ctx.stroke();
  }

  // Main circle
  ctx.beginPath();
  ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
  ctx.fillStyle   = isActive ? COLORS.cornerActive : COLORS.cornerPlaced;
  ctx.fill();

  ctx.shadowBlur = 0;

  // Corner label
  const labelOffsets: Record<CornerID, [number, number]> = {
    tl: [-5,  -28],
    tr: [ 5,  -28],
    br: [ 5,   38],
    bl: [-5,   38],
  };
  const [lx, ly] = labelOffsets[id];

  drawLabel(ctx, x + lx, y + ly, CORNER_LABELS[id], isActive ? COLORS.cornerActive : COLORS.dimensionText);
}

/** Ghost guide shown at a sensible default position for unplaced corners */
function drawActiveGuide(
  ctx:   CanvasRenderingContext2D,
  x:     number,
  y:     number,
  index: number,
): void {
  // Pulsing ring to guide user
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.cornerActive;
  ctx.lineWidth   = 2;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Cross
  ctx.strokeStyle = COLORS.cornerActive;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x + 10, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x, y + 10);
  ctx.stroke();
}

// ─── Layer 5: Dimension Labels ────────────────────────────────

function drawDimensionLabels(
  ctx:          CanvasRenderingContext2D,
  corners:      CornerSet,
  widthM:       number,
  lengthM:      number,
  skewWarning:  boolean,
): void {
  ctx.save();

  // Width label on top edge midpoint
  const topMidX = (corners.tl.screen.x + corners.tr.screen.x) / 2;
  const topMidY = (corners.tl.screen.y + corners.tr.screen.y) / 2;
  drawDimBox(ctx, topMidX, topMidY - 28, `${widthM.toFixed(1)} m`, "↔");

  // Length label on right edge midpoint
  const rightMidX = (corners.tr.screen.x + corners.br.screen.x) / 2;
  const rightMidY = (corners.tr.screen.y + corners.br.screen.y) / 2;
  drawDimBox(ctx, rightMidX + 44, rightMidY, `${lengthM.toFixed(1)} m`, "↕");

  // Area label in centre
  const cx = (corners.tl.screen.x + corners.tr.screen.x +
               corners.br.screen.x + corners.bl.screen.x) / 4;
  const cy = (corners.tl.screen.y + corners.tr.screen.y +
               corners.br.screen.y + corners.bl.screen.y) / 4;
  const area = widthM * lengthM;
  drawDimBox(ctx, cx, cy, `${area.toFixed(1)} m²`, "▣", true);

  // Skew warning
  if (skewWarning) {
    drawWarning(ctx, cx, cy + 40, "Corners not aligned — check placement");
  }

  ctx.restore();
}

function drawDimBox(
  ctx:    CanvasRenderingContext2D,
  x:      number,
  y:      number,
  text:   string,
  icon:   string,
  large = false,
): void {
  const fontSize = large ? 15 : 12;
  const fullText = `${icon}  ${text}`;

  ctx.font         = `600 ${fontSize}px -apple-system, sans-serif`;
  const measured   = ctx.measureText(fullText);
  const padX       = 10;
  const padY       = 6;
  const bw         = measured.width + padX * 2;
  const bh         = fontSize + padY * 2;

  // Rounded background
  ctx.fillStyle    = COLORS.dimensionBg;
  roundRect(ctx, x - bw / 2, y - bh / 2, bw, bh, 6);
  ctx.fill();

  // Text
  ctx.fillStyle    = COLORS.dimensionText;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(fullText, x, y);
}

function drawWarning(
  ctx:  CanvasRenderingContext2D,
  x:    number,
  y:    number,
  text: string,
): void {
  ctx.font         = "500 11px -apple-system, sans-serif";
  const measured   = ctx.measureText(text);
  const padX       = 8;
  const padY       = 5;
  const bw         = measured.width + padX * 2 + 20;
  const bh         = 22;

  ctx.fillStyle    = "rgba(251,191,36,0.15)";
  roundRect(ctx, x - bw / 2, y - bh / 2, bw, bh, 4);
  ctx.fill();

  ctx.strokeStyle  = "rgba(251,191,36,0.5)";
  ctx.lineWidth    = 1;
  roundRect(ctx, x - bw / 2, y - bh / 2, bw, bh, 4);
  ctx.stroke();

  ctx.fillStyle    = COLORS.warningText;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`⚠  ${text}`, x, y);
}

// ─── Layer 6: Instructions ────────────────────────────────────

export function drawInstructions(
  ctx:    CanvasRenderingContext2D,
  w:      number,
  h:      number,
  state:  RenderState,
): void {
  const { sessionState, placedCount, activeCorner } = state;

  let message = "";
  let subtext  = "";

  switch (sessionState) {
    case "calibrating":
      message = "Point camera at the space";
      subtext  = "Hold your phone steady";
      break;

    case "placing_corners":
      if (placedCount === 0) {
        message = `Tap the ${CORNER_LABELS[activeCorner ?? "tl"]} corner`;
        subtext  = "Start at the top-left corner of the space";
      } else if (placedCount < 4) {
        message = `Now tap the ${CORNER_LABELS[activeCorner ?? "tr"]} corner`;
        subtext  = `${placedCount}/4 corners placed`;
      } else {
        message = "All corners placed";
        subtext  = "Drag to adjust, then confirm";
      }
      break;

    case "confirming":
      message = "Does this look right?";
      subtext  = "Adjust corners if needed, then confirm";
      break;

    case "processing":
      message = "Calculating dimensions...";
      break;

    default:
      return;
  }

  if (!message) return;

  ctx.save();

  // Bottom pill
  const fontSize  = 15;
  const subSize   = 12;
  ctx.font        = `600 ${fontSize}px -apple-system, sans-serif`;
  const mainW     = ctx.measureText(message).width;
  ctx.font        = `400 ${subSize}px -apple-system, sans-serif`;
  const subW      = ctx.measureText(subtext).width;
  const boxW      = Math.max(mainW, subW) + 32;
  const boxH      = subtext ? 56 : 36;
  const bx        = w / 2 - boxW / 2;
  const by        = h - boxH - 24;

  ctx.fillStyle   = COLORS.instructionBg;
  roundRect(ctx, bx, by, boxW, boxH, 12);
  ctx.fill();

  ctx.fillStyle    = COLORS.instructionText;
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";

  if (subtext) {
    ctx.font       = `600 ${fontSize}px -apple-system, sans-serif`;
    ctx.fillText(message, w / 2, by + 22);
    ctx.font       = `400 ${subSize}px -apple-system, sans-serif`;
    ctx.fillStyle  = "rgba(255,255,255,0.6)";
    ctx.fillText(subtext, w / 2, by + 42);
  } else {
    ctx.font       = `600 ${fontSize}px -apple-system, sans-serif`;
    ctx.fillText(message, w / 2, by + 22);
  }

  // Step indicator dots
  if (sessionState === "placing_corners") {
    const dotY   = by - 16;
    const dotR   = 4;
    const dotGap = 12;
    const totalW = 4 * dotR * 2 + 3 * dotGap;
    let dotX     = w / 2 - totalW / 2 + dotR;

    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = i < state.placedCount
        ? COLORS.cornerPlaced
        : "rgba(255,255,255,0.25)";
      ctx.fill();
      dotX += dotR * 2 + dotGap;
    }
  }

  ctx.restore();
}

// ─── Utilities ────────────────────────────────────────────────

function drawLabel(
  ctx:   CanvasRenderingContext2D,
  x:     number,
  y:     number,
  text:  string,
  color: string,
): void {
  ctx.font         = "600 10px -apple-system, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";

  const w   = ctx.measureText(text).width + 10;
  const h   = 16;

  ctx.fillStyle = COLORS.labelBg;
  roundRect(ctx, x - w/2, y - h/2, w, h, 4);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function roundRect(
  ctx:  CanvasRenderingContext2D,
  x:    number,
  y:    number,
  w:    number,
  h:    number,
  r:    number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function getPlacedCorners(corners: CornerSet) {
  return (["tl", "tr", "br", "bl"] as CornerID[])
    .filter(id => corners[id].isPlaced)
    .map(id => corners[id]);
}
