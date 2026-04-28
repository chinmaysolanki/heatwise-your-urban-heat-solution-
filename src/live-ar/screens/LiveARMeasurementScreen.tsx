import React, { useRef, useState, useEffect, useCallback } from "react";
import { buildMeasurementResult } from "../geometry";
import { liveARMeasurementToProjectInput } from "../adapters";
import type { WorldPoint3D, LiveARMeasurementResult } from "../types";
import { detectArucoScale, drawArucoOverlay } from "../../utils/arucoScaling";
import type { ArucoDetection } from "../../utils/arucoScaling";

/** Convert any image file (including HEIC) to a JPEG data URL for canvas rendering. */
async function fileToJpegDataUrl(file: File): Promise<string> {
  // Step 1: try native createImageBitmap — works for all formats Safari supports (incl. HEIC)
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width  = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.92);
  } catch {
    // Step 2: for HEIC in Chrome, use heic2any WASM converter
    const isHeic = /\.(heic|heif)$/i.test(file.name)
      || file.type === "image/heic"
      || file.type === "image/heif";
    if (!isHeic) throw new Error("Unsupported image format");

    const heic2any = (await import("heic2any")).default;
    const result   = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.90 });
    const blob     = Array.isArray(result) ? result[0]! : result;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target!.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

// ─── Color tokens ────────────────────────────────────────────────────────────
const C = {
  green:    "#2D6A4F",
  greenDim: "rgba(45,106,79,0.10)",
  greenGlow:"rgba(45,106,79,0.22)",
  sky:      "#40916C",
  skyDim:   "rgba(64,145,108,0.10)",
  gold:     "rgba(249,199,79,1)",
  goldDim:  "rgba(249,199,79,0.22)",
  heat:     "rgba(231,111,81,1)",
  bg:       "#F2F3F7",
  panel:    "rgba(255,255,255,0.97)",
  text:     "#374151",
  textDim:  "#9CA3AF",
  cardGreen:"#E8F5EC",
};

const CORNER_COLORS = [C.green, C.sky, C.gold, C.heat];
const CORNER_LABELS = ["A", "B", "C", "D"];

// ─── Types ───────────────────────────────────────────────────────────────────
type Phase        = "intro" | "requesting" | "active" | "confirmed" | "error";
type CaptureMode  = "live" | "gallery";

/**
 * Capture angle detected from device orientation beta + gamma.
 * Controls tips shown to the user AND adjusts perspective math.
 */
type AngleMode =
  | "overhead"   // phone nearly flat, looking straight down (beta < 30)
  | "high"       // steep downward angle, e.g. from ladder (beta 30-55)
  | "mid"        // typical diagonal scan (beta 55-70)
  | "low"        // near-horizontal, looking across at roof edge (beta 70-82)
  | "horizontal" // phone nearly upright, shooting horizontally (beta > 82)
  | "rolled"     // phone tilted sideways (|gamma| > 25)

interface ScreenCorner { x: number; y: number; world: WorldPoint3D; label: string; }
interface OrientData   { beta: number; gamma: number; hasData: boolean; }

// ─── Angle detection ─────────────────────────────────────────────────────────
function detectAngleMode(beta: number, gamma: number): AngleMode {
  if (Math.abs(gamma) > 25) return "rolled";
  if (beta < 30)  return "overhead";
  if (beta < 55)  return "high";
  if (beta < 70)  return "mid";
  if (beta < 82)  return "low";
  return "horizontal";
}

const ANGLE_META: Record<AngleMode, { icon: string; label: string; tip: string; color: string }> = {
  overhead:   { icon: "⬇",  label: "OVERHEAD",   color: "rgba(82,183,136,1)",  tip: "Hold higher — aim at all 4 corners from above." },
  high:       { icon: "↙",  label: "HIGH ANGLE",  color: "rgba(82,183,136,1)",  tip: "Great angle! Tap each corner clearly visible." },
  mid:        { icon: "↘",  label: "MID ANGLE",   color: "rgba(82,183,136,1)",  tip: "Good view. Place corners at the rooftop edges." },
  low:        { icon: "→",  label: "LOW ANGLE",   color: "rgba(249,199,79,1)",  tip: "Angle looks low — front edges will be larger in the image." },
  horizontal: { icon: "↗",  label: "HORIZONTAL",  color: "rgba(231,111,81,1)",  tip: "Too horizontal — tilt phone more toward the roof." },
  rolled:     { icon: "↺",  label: "TILTED",      color: "rgba(231,111,81,1)",  tip: "Phone is sideways. Rotate so long side aligns with roof length." },
};

// ─── Axis guidance after first two corners ────────────────────────────────────
function edgeAxisLabel(corners: ScreenCorner[], W: number, H: number): string | null {
  if (corners.length !== 2) return null;
  const dx = Math.abs(corners[1].x - corners[0].x);
  const dy = Math.abs(corners[1].y - corners[0].y);
  const isLengthAxis = dx > dy;   // wider span = length axis
  return isLengthAxis ? "Measuring LENGTH → now tap BREADTH corners" : "Measuring BREADTH → now tap LENGTH corners";
}

// ─── Perspective-correct screenToWorld ───────────────────────────────────────
/**
 * Converts a screen tap (sx,sy) into a 3-D world point on the floor plane,
 * using a full perspective camera model:
 *
 *   beta  (DeviceOrientationEvent.beta):
 *     0   = phone face-up (camera points straight down)
 *     90  = phone upright / portrait (camera horizontal)
 *   gamma (DeviceOrientationEvent.gamma):
 *     0   = phone level (no roll)
 *     +ve = right side lower
 *
 * We build a rotation matrix Ry(0) * Rx(elevation) * Rz(roll) and ray-cast
 * against the floor plane y = 0.
 */
function screenToWorld(
  sx: number, sy: number,
  W: number, H: number,
  beta: number,
  gamma: number,
): WorldPoint3D {
  // ── Camera intrinsics ──────────────────────────────────────────────────────
  const hFovRad = (65 * Math.PI) / 180;
  const vFovRad = hFovRad * (H / W);

  // ── Angular offset of this pixel from image centre ─────────────────────────
  const ax = ((sx - W / 2) / (W / 2)) * (hFovRad / 2);   // +right
  const ay = ((sy - H / 2) / (H / 2)) * (vFovRad / 2);   // +down-screen

  // ── Camera-space ray (x=right, y=up, z=into scene) ─────────────────────────
  const rxC =  Math.tan(ax);
  const ryC = -Math.tan(ay);  // invert: screen-down → world-up
  const rzC =  1.0;
  const len  = Math.sqrt(rxC * rxC + ryC * ryC + rzC * rzC);
  let rx = rxC / len, ry = ryC / len, rz = rzC / len;

  // ── Roll correction (Rz) — phone tilted sideways via gamma ─────────────────
  const rollRad = (gamma * Math.PI) / 180;
  const cosR = Math.cos(rollRad), sinR = Math.sin(rollRad);
  const rx1 = rx * cosR - ry * sinR;
  const ry1 = rx * sinR + ry * cosR;
  const rz1 = rz;
  rx = rx1; ry = ry1; rz = rz1;

  // ── Pitch / elevation (Rx) — derived from DeviceOrientationEvent.beta ─────
  // beta=90 → camera horizontal (elev=0°), beta=0 → camera straight down (elev=-90°)
  const elevDeg = beta - 90;               // negative = looking downward
  const elevRad = (elevDeg * Math.PI) / 180;
  const cosE = Math.cos(elevRad), sinE = Math.sin(elevRad);
  const rx2 = rx;
  const ry2 = ry * cosE - rz * sinE;
  const rz2 = ry * sinE + rz * cosE;
  rx = rx2; ry = ry2; rz = rz2;

  // ── Camera height above the measurement plane ──────────────────────────────
  // Estimated from tilt: phone nearly flat → user holding above, ~1.8 m
  //                      phone near-horizontal → shooting across, ~1.0 m
  const camH = beta < 30 ? 1.8 : beta < 55 ? 1.6 : beta < 70 ? 1.3 : 1.0;

  // ── Ray–floor intersection (y = 0) ────────────────────────────────────────
  // Camera at (0, camH, 0); ray direction (rx, ry, rz)
  // t = -camH / ry  (only valid when ry < 0, ray going downward)
  if (ry >= -0.015) {
    // Ray nearly horizontal or going up — clamp to a reasonable ground point
    const safeT = camH * 4;
    return { id: ptId(), x: safeT * rx, y: 0, z: safeT * rz };
  }

  const t = Math.min(40, -camH / ry);   // cap at 40 m to avoid wild extrapolation
  return { id: ptId(), x: t * rx, y: 0, z: t * rz };
}

/** Tilt-scenario-aware camera-height nudge: used ONLY for confidence scoring. */
function estimateCamHeightForAngle(beta: number): number {
  return beta < 30 ? 1.8 : beta < 55 ? 1.6 : beta < 70 ? 1.3 : 1.0;
}

function ptId(): string {
  return `pt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Returns the rendered bounds of an <img objectFit="contain"> within its element.
 * Accounts for letterboxing: the image may be centered with transparent/black bars.
 * All values are relative to the img element's top-left corner.
 */
function getContainedImageBounds(img: HTMLImageElement): { left: number; top: number; width: number; height: number } {
  const elemW = img.clientWidth  || img.offsetWidth;
  const elemH = img.clientHeight || img.offsetHeight;
  const natW  = img.naturalWidth  || elemW;
  const natH  = img.naturalHeight || elemH;
  const scale = Math.min(elemW / natW, elemH / natH);
  const rendW = natW * scale;
  const rendH = natH * scale;
  return {
    left:   (elemW - rendW) / 2,
    top:    (elemH - rendH) / 2,
    width:  rendW,
    height: rendH,
  };
}

/** Same logic as getContainedImageBounds but uses canvas pixel dimensions (W×H) as the container. */
function getContainedImageBoundsOnCanvas(img: HTMLImageElement, W: number, H: number): { left: number; top: number; width: number; height: number } {
  const natW = img.naturalWidth  || W;
  const natH = img.naturalHeight || H;
  const scale = Math.min(W / natW, H / natH);
  const rendW = natW * scale;
  const rendH = natH * scale;
  return { left: (W - rendW) / 2, top: (H - rendH) / 2, width: rendW, height: rendH };
}

function dist2D(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

// ── Capture a JPEG data-URL from a playing video element ──────────────────────
function captureVideoFrame(video: HTMLVideoElement): string | null {
  try {
    const c = document.createElement("canvas");
    c.width  = video.videoWidth  || video.clientWidth;
    c.height = video.videoHeight || video.clientHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } catch { return null; }
}

/**
 * Crops a photo (data-URL) to the polygon defined by the 4 AR corner dots.
 *
 * Coordinate mapping:
 *  - live  (objectFit:cover)    : corners are CSS canvas px → map to native video px
 *  - gallery (objectFit:contain): corners are CSS canvas px → map to native image px
 *
 * Returns a JPEG data-URL of just the bounding-box region of the polygon,
 * with the outside masked out.
 */
async function cropPhotoToCorners(
  photoDataUrl: string,
  corners: { x: number; y: number }[],
  canvasW: number,
  canvasH: number,
  mode: "live" | "gallery",
  videoEl?: HTMLVideoElement,
  imgEl?: HTMLImageElement,
): Promise<string> {
  // Load the source image
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload  = () => res(i);
    i.onerror = rej;
    i.src = photoDataUrl;
  });

  const natW = img.naturalWidth;
  const natH = img.naturalHeight;

  // Map each corner from CSS-canvas coordinates → native photo coordinates
  let mappedCorners: { x: number; y: number }[];

  if (mode === "live") {
    // objectFit:cover — the video is scaled so it fills the canvas, centered
    const vidW = videoEl?.videoWidth  || natW;
    const vidH = videoEl?.videoHeight || natH;
    const scaleX = vidW / canvasW;
    const scaleY = vidH / canvasH;
    // cover scale: whichever axis is *larger* fills the canvas
    const vScale = Math.max(vidW / canvasW, vidH / canvasH);
    const offsetX = (vidW - canvasW * vScale) / 2;
    const offsetY = (vidH - canvasH * vScale) / 2;
    // Canvas captured at native video res, so natW===vidW, natH===vidH
    mappedCorners = corners.map(c => ({
      x: c.x * vScale + offsetX,
      y: c.y * vScale + offsetY,
    }));
  } else {
    // objectFit:contain — image is letterboxed/pillarboxed inside the canvas
    const tmpImg = imgEl ?? img;
    const bounds = getContainedImageBoundsOnCanvas(tmpImg, canvasW, canvasH);
    // scale: how many native px per CSS px of the rendered image
    const scaleX = (tmpImg.naturalWidth  || natW) / bounds.width;
    const scaleY = (tmpImg.naturalHeight || natH) / bounds.height;
    mappedCorners = corners.map(c => ({
      x: (c.x - bounds.left) * scaleX,
      y: (c.y - bounds.top)  * scaleY,
    }));
  }

  // Compute bounding box of the mapped polygon (clamped to photo size)
  const xs = mappedCorners.map(c => c.x);
  const ys = mappedCorners.map(c => c.y);
  const minX = Math.max(0,    Math.min(...xs));
  const minY = Math.max(0,    Math.min(...ys));
  const maxX = Math.min(natW, Math.max(...xs));
  const maxY = Math.min(natH, Math.max(...ys));
  const cropW = Math.round(maxX - minX);
  const cropH = Math.round(maxY - minY);

  if (cropW <= 0 || cropH <= 0) return photoDataUrl; // safety fallback

  // Draw the clipped region onto a new canvas
  const out = document.createElement("canvas");
  out.width  = cropW;
  out.height = cropH;
  const ctx = out.getContext("2d")!;

  // Clip to the polygon (translated so bounding-box top-left = 0,0)
  ctx.beginPath();
  mappedCorners.forEach((c, i) => {
    const px = c.x - minX;
    const py = c.y - minY;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.clip();

  // Draw the source image (offset so bounding-box top-left aligns with canvas origin)
  ctx.drawImage(img, -minX, -minY, natW, natH);

  return out.toDataURL("image/jpeg", 0.90);
}

// ─── Canvas draw helpers ──────────────────────────────────────────────────────
// NOTE: canvas is a transparent overlay on top of the <video> or <img> element.
// Never fill the full canvas background.

/**
 * Cross-browser rounded-rect path helper.
 * Uses native ctx.roundRect() when available (Chrome 99+, Safari 15.4+, FF 112+),
 * falls back to quadraticCurveTo() for older WebViews.
 */
function rRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof (ctx as any).roundRect === "function") {
    (ctx as any).roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawPerspectiveGrid(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, angleMode: AngleMode) {
  const horizon = angleMode === "overhead" ? H * 0.25
                : angleMode === "high"     ? H * 0.35
                : angleMode === "low"      ? H * 0.55
                : angleMode === "horizontal" ? H * 0.65
                : H * 0.42;
  ctx.save();
  const lines = 10;
  for (let i = 0; i <= lines; i++) {
    const frac = i / lines;
    const alpha = frac * 0.30 + 0.04;
    ctx.strokeStyle = `rgba(82,183,136,${alpha})`;
    ctx.lineWidth = 0.7;
    const yPos = horizon + (H - horizon) * frac;
    ctx.beginPath(); ctx.moveTo(0, yPos); ctx.lineTo(W, yPos); ctx.stroke();
    const spread = frac * W * 0.52;
    ctx.beginPath(); ctx.moveTo(W / 2, horizon); ctx.lineTo(W / 2 - spread, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2, horizon); ctx.lineTo(W / 2 + spread, H); ctx.stroke();
  }
  // Animated scan line
  const scanFrac = (Math.sin(t * 0.75) + 1) / 2;
  const scanY    = horizon + (H - horizon) * scanFrac;
  const grad = ctx.createLinearGradient(0, scanY, W, scanY);
  grad.addColorStop(0,   "rgba(82,183,136,0)");
  grad.addColorStop(0.4, "rgba(82,183,136,0.26)");
  grad.addColorStop(0.6, "rgba(82,183,136,0.26)");
  grad.addColorStop(1,   "rgba(82,183,136,0)");
  ctx.strokeStyle = grad; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, scanY); ctx.lineTo(W, scanY); ctx.stroke();
  ctx.restore();
}

function drawRadar(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  const cx = W / 2, cy = H * 0.5;
  for (let i = 0; i < 3; i++) {
    const phase = (t * 0.5 + i * 0.9) % (Math.PI * 2);
    const r = 38 + Math.sin(phase) * 28;
    const a = Math.cos(phase) * 0.11 + 0.04;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(82,183,136,${Math.max(0, a)})`; ctx.lineWidth = 1; ctx.stroke();
  }
}

function drawCorner(ctx: CanvasRenderingContext2D, corner: ScreenCorner, idx: number, t: number) {
  const { x, y, label } = corner;
  const color = CORNER_COLORS[idx % CORNER_COLORS.length]!;
  const pulse = 1 + Math.sin(t * 3) * 0.07;
  ctx.save();
  // Outer glow
  ctx.beginPath(); ctx.arc(x, y, 22 * pulse, 0, Math.PI * 2);
  ctx.strokeStyle = color.replace("1)", "0.28)"); ctx.lineWidth = 2; ctx.stroke();
  // Middle ring
  ctx.beginPath(); ctx.arc(x, y, 14 * pulse, 0, Math.PI * 2);
  ctx.strokeStyle = color.replace("1)", "0.6)");  ctx.lineWidth = 1.5; ctx.stroke();
  // Inner dot
  ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  // Label
  ctx.font = "bold 11px 'DM Sans', sans-serif";
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, x, y - 26 * pulse);
  ctx.restore();
}

function drawPolygon(ctx: CanvasRenderingContext2D, corners: ScreenCorner[], t: number) {
  if (corners.length < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(corners[0]!.x, corners[0]!.y);
  for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i]!.x, corners[i]!.y);
  if (corners.length >= 3) {
    ctx.closePath();
    ctx.fillStyle = "rgba(82,183,136,0.07)"; ctx.fill();
  }
  ctx.strokeStyle = `rgba(82,183,136,${0.5 + Math.sin(t * 2) * 0.14})`;
  ctx.lineWidth = 2; ctx.setLineDash([8, 5]); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

function drawDimensions(ctx: CanvasRenderingContext2D, corners: ScreenCorner[]) {
  if (corners.length < 2) return;
  ctx.save();
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % corners.length]!;
    if (i + 1 >= corners.length && corners.length < 3) continue;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const d = Math.sqrt((b.world.x - a.world.x) ** 2 + (b.world.z - a.world.z) ** 2);
    if (d < 0.1) continue;
    const axisLabel = i === 0 ? "L" : i === 1 ? "W" : i === 2 ? "L" : "W";
    ctx.fillStyle = "rgba(9,22,14,0.78)";
    ctx.beginPath(); rRect(ctx, mx - 26, my - 11, 52, 22, 5); ctx.fill();
    ctx.font = "bold 11px 'DM Sans', sans-serif";
    ctx.fillStyle = "rgba(216,243,220,1)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`${axisLabel}:${d.toFixed(1)}m`, mx, my);
  }
  ctx.restore();
}

function drawAngleBadge(ctx: CanvasRenderingContext2D, W: number, angleMode: AngleMode) {
  // Drawn below the top bar (≈80px from top)
  const m = ANGLE_META[angleMode];
  const text = `${m.icon} ${m.label}`;
  ctx.save();
  ctx.font = "bold 10px 'DM Sans', sans-serif";
  const tw = ctx.measureText(text).width + 18;
  const TOP = 84;
  ctx.fillStyle = "rgba(9,22,14,0.82)";
  ctx.beginPath(); rRect(ctx, W - tw - 10, TOP, tw, 26, 6); ctx.fill();
  ctx.fillStyle = m.color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, W - tw / 2 - 10, TOP + 13);
  ctx.restore();
}

function drawAxisHint(ctx: CanvasRenderingContext2D, W: number, H: number, corners: ScreenCorner[]) {
  const hint = edgeAxisLabel(corners, W, H);
  if (!hint) return;
  ctx.save();
  ctx.font = "12px 'DM Sans', sans-serif";
  const tw = ctx.measureText(hint).width + 22;
  const AY = H - 220; // above the bottom bar
  ctx.fillStyle = "rgba(72,202,228,0.14)";
  ctx.beginPath(); rRect(ctx, W / 2 - tw / 2, AY, tw, 28, 6); ctx.fill();
  ctx.strokeStyle = "rgba(72,202,228,0.5)"; ctx.lineWidth = 1;
  ctx.beginPath(); rRect(ctx, W / 2 - tw / 2, AY, tw, 28, 6); ctx.stroke();
  ctx.fillStyle = "rgba(72,202,228,0.95)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(hint, W / 2, AY + 14);
  ctx.restore();
}

function drawNextGuide(ctx: CanvasRenderingContext2D, W: number, H: number, nextIdx: number) {
  // Bottom bar already shows corner progress — only draw a subtle crosshair in centre-screen
  if (nextIdx >= 4 || nextIdx === 0) return; // skip on first tap (radar handles it) and when done
  const color = CORNER_COLORS[nextIdx]!;
  const label = CORNER_LABELS[nextIdx]!;
  const msg = `→ Tap corner ${label}`;
  ctx.save();
  ctx.font = "bold 12px 'DM Sans', sans-serif";
  const tw = ctx.measureText(msg).width + 20;
  // Place in centre of visible camera area (between top bar and bottom bar)
  const CY = H * 0.62;
  ctx.fillStyle = "rgba(9,22,14,0.72)";
  ctx.beginPath(); rRect(ctx, W / 2 - tw / 2, CY - 15, tw, 30, 7); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(msg, W / 2, CY);
  ctx.restore();
}

function drawInstructions(ctx: CanvasRenderingContext2D, W: number, H: number, count: number) {
  // Drawn below the top bar (≈80px from top) to avoid overlapping the header
  const msg = count === 0 ? "Tap 4 rooftop corners"
            : count < 4   ? `${4 - count} more corner${4 - count > 1 ? "s" : ""} to place`
            : "Confirm or drag corners to adjust";
  ctx.save();
  ctx.font = "13px 'DM Sans', sans-serif";
  const tw = ctx.measureText(msg).width + 24;
  const TOP = 84;
  ctx.fillStyle = "rgba(9,22,14,0.82)";
  ctx.beginPath(); rRect(ctx, W / 2 - tw / 2, TOP, tw, 30, 7); ctx.fill();
  ctx.fillStyle = "rgba(216,243,220,0.9)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(msg, W / 2, TOP + 15);
  ctx.restore();
}

function drawTipBanner(ctx: CanvasRenderingContext2D, W: number, angleMode: AngleMode) {
  const tip = ANGLE_META[angleMode].tip;
  if (angleMode === "mid" || angleMode === "high") return; // no banner needed for good angles
  ctx.save();
  ctx.font = "11px 'DM Sans', sans-serif";
  const tw = Math.min(W - 32, ctx.measureText(tip).width + 22);
  const x = W / 2 - tw / 2;
  const y = 120; // below instructions banner
  ctx.fillStyle = angleMode === "rolled" || angleMode === "horizontal"
    ? "rgba(231,111,81,0.18)" : "rgba(249,199,79,0.14)";
  ctx.beginPath(); rRect(ctx, x, y, tw, 26, 6); ctx.fill();
  ctx.strokeStyle = angleMode === "rolled" || angleMode === "horizontal"
    ? "rgba(231,111,81,0.5)" : "rgba(249,199,79,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath(); rRect(ctx, x, y, tw, 26, 6); ctx.stroke();
  ctx.fillStyle = angleMode === "rolled" || angleMode === "horizontal"
    ? "rgba(231,111,81,0.9)" : "rgba(249,199,79,0.9)";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(tip, W / 2, y + 13);
  ctx.restore();
}

function drawConfirmedOverlay(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.save();
  ctx.fillStyle = "rgba(9,22,14,0.50)"; ctx.fillRect(0, 0, W, H);
  ctx.font = "bold 21px 'DM Sans', sans-serif";
  ctx.fillStyle = "rgba(82,183,136,1)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("✓ Measurement Confirmed", W / 2, H / 2);
  ctx.restore();
}

// ─── Main component ───────────────────────────────────────────────────────────
type Props = {
  projectId?:     string | null;
  photoSessionId?: string | null;
  onApplied(result: { measurement: LiveARMeasurementResult; projectInput: any; capturedPhoto: string | null }): void;
  onCancel(): void;
};

export function LiveARMeasurementScreen({ projectId, photoSessionId, onApplied, onCancel }: Props) {
  // ── Core refs ──────────────────────────────────────────────────────────────
  const videoRef    = useRef<HTMLVideoElement>(null);
  const imgRef      = useRef<HTMLImageElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const frameRef    = useRef<number>(0);
  const orientRef   = useRef<OrientData>({ beta: 55, gamma: 0, hasData: false });
  const cornersRef  = useRef<ScreenCorner[]>([]);
  const resultRef   = useRef<LiveARMeasurementResult | null>(null);
  const timeRef     = useRef<number>(0);
  const dragRef     = useRef<number | null>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const galleryImgRef = useRef<HTMLImageElement | null>(null);  // pre-loaded Image object

  // ── ArUco scaling refs ─────────────────────────────────────────────────────
  const arucoScaleRef    = useRef<number | null>(null);           // metresPerPixel from marker
  const arucoDetRef      = useRef<ArucoDetection | null>(null);   // last detection (canvas coords)
  const arucoTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const arucoMissRef     = useRef<number>(0);                     // consecutive frames without marker

  // ── State ──────────────────────────────────────────────────────────────────
  const [phase,        setPhase]        = useState<Phase>("intro");
  const [captureMode,  setCaptureMode]  = useState<CaptureMode>("live");
  const [corners,      setCorners]      = useState<ScreenCorner[]>([]);
  const [cameraErr,    setCameraErr]    = useState<string>("");
  const [applying,     setApplying]     = useState(false);
  const [confirmDone,  setConfirmDone]  = useState(false);
  const [angleMode,    setAngleMode]    = useState<AngleMode>("mid");
  const [galleryPhoto, setGalleryPhoto] = useState<string | null>(null);  // JPEG data URL
  const [converting,   setConverting]   = useState(false);               // HEIC conversion in progress
  /** Simulated beta angle for gallery photos (no live device orientation available). */
  const [galleryBeta,  setGalleryBeta]  = useState<number>(60);  // 60° ≈ "mid" angle
  const [arucoDetected, setArucoDetected] = useState(false);
  /** Frame captured from live camera — shown frozen so user can tap corners precisely. */
  const [capturedLiveFrame, setCapturedLiveFrame] = useState<string | null>(null);
  /** Brief white flash shown when user taps the shutter button. */
  const [captureFlash, setCaptureFlash] = useState(false);

  // Keep cornersRef in sync
  useEffect(() => { cornersRef.current = corners; }, [corners]);

  // ── Camera lifecycle ───────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setPhase("requesting");
    setCaptureMode("live");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase("active");
    } catch (err: any) {
      setCameraErr(err?.message || "Camera access denied");
      setPhase("error");
    }
  }, []);

  // Attach stream after <video> mounts (phase flip → re-render → effect)
  useEffect(() => {
    if (phase !== "active" || captureMode !== "live") return;
    const video  = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || video.srcObject === stream) return;
    video.srcObject = stream;
    video.play().catch(() => {});
  }, [phase, captureMode]);

  // ── Gallery mode ───────────────────────────────────────────────────────────
  const openGallery = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/")
      || /\.(heic|heif|jpg|jpeg|png|webp|gif|bmp)$/i.test(file.name);
    if (!isImage) {
      setCameraErr("Please select an image file");
      setPhase("error");
      return;
    }
    e.target.value = "";
    setConverting(true);
    fileToJpegDataUrl(file)
      .then(dataUrl => {
        setConverting(false);
        if (dataUrl) setGalleryPhoto(dataUrl);
      })
      .catch(() => {
        setConverting(false);
        setCameraErr("Could not read this image. Please try a JPEG or PNG file.");
        setPhase("error");
      });
  }, []);

  // Load gallery image whenever galleryPhoto changes (works from ANY phase).
  // Stops live camera, pre-loads the image into galleryImgRef, then transitions to gallery mode.
  useEffect(() => {
    if (!galleryPhoto) return;
    const img = new Image();
    img.onload = () => {
      galleryImgRef.current = img;
      // Stop live camera if it was running
      stopCamera();
      setCaptureMode("gallery");
      setPhase("active");
      setCorners([]);
      resultRef.current = null;
    };
    img.onerror = () => {
      setCameraErr("Failed to display the selected image. Please use a JPEG or PNG.");
      setPhase("error");
    };
    img.src = galleryPhoto;
  }, [galleryPhoto, stopCamera]);

  // Handle captured live frame — like gallery mode but PRESERVES existing corners.
  useEffect(() => {
    if (!capturedLiveFrame) return;
    const img = new Image();
    img.onload = () => {
      galleryImgRef.current = img;
      stopCamera();
      setCaptureMode("gallery");
      setPhase("active");
      // Intentionally do NOT reset corners — user may have pre-placed some
    };
    img.src = capturedLiveFrame;
  }, [capturedLiveFrame, stopCamera]);

  /** Capture the current live video frame, flash, then freeze it for precise corner tapping. */
  const handleCaptureLive = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const dataUrl = captureVideoFrame(video);
    if (!dataUrl) return;
    // White flash feedback
    setCaptureFlash(true);
    setTimeout(() => setCaptureFlash(false), 280);
    setCapturedLiveFrame(dataUrl);
  }, []);

  // ── Device orientation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "active" && phase !== "confirmed") return;
    const handler = (e: DeviceOrientationEvent) => {
      const beta  = e.beta  ?? 55;
      const gamma = e.gamma ?? 0;
      orientRef.current = { beta, gamma, hasData: true };
      setAngleMode(detectAngleMode(beta, gamma));
    };
    const setup = async () => {
      if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
        try { await (DeviceOrientationEvent as any).requestPermission(); } catch {}
      }
      window.addEventListener("deviceorientation", handler, true);
    };
    setup();
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, [phase]);

  // ── ArUco detection loop (live mode only) ─────────────────────────────────
  useEffect(() => {
    if (phase !== "active" || captureMode !== "live") {
      if (arucoTimerRef.current) { clearInterval(arucoTimerRef.current); arucoTimerRef.current = null; }
      return;
    }
    arucoTimerRef.current = setInterval(async () => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      // Capture video frame in canvas-pixel coordinates (replicates objectFit:cover)
      const cw = canvas.width  || canvas.clientWidth  || 390;
      const ch = canvas.height || canvas.clientHeight || 844;
      const vw = video.videoWidth; const vh = video.videoHeight;
      if (!vw || !vh) return;
      const scale = Math.max(cw / vw, ch / vh);
      const sw = vw * scale; const sh = vh * scale;
      const ox = (cw - sw) / 2; const oy = (ch - sh) / 2;
      const tmp = document.createElement("canvas");
      tmp.width = cw; tmp.height = ch;
      const tctx = tmp.getContext("2d");
      if (!tctx) return;
      tctx.drawImage(video, ox, oy, sw, sh);
      const imageData = tctx.getImageData(0, 0, cw, ch);
      const result = await detectArucoScale(imageData, 0.10);
      if (result.detected && result.detection && result.metresPerPixel) {
        arucoScaleRef.current = result.metresPerPixel;
        arucoDetRef.current   = result.detection;
        arucoMissRef.current  = 0;
        setArucoDetected(true);
      } else {
        arucoMissRef.current += 1;
        // After 8 missed frames (~5 s) assume marker gone
        if (arucoMissRef.current > 8) {
          arucoScaleRef.current = null;
          arucoDetRef.current   = null;
          setArucoDetected(false);
        }
      }
    }, 600);
    return () => { if (arucoTimerRef.current) { clearInterval(arucoTimerRef.current); arucoTimerRef.current = null; } };
  }, [phase, captureMode]);

  // ── Resize canvas ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "active" && phase !== "confirmed") return;
    const resize = () => {
      const c = canvasRef.current;
      if (!c) return;
      c.width  = c.clientWidth;
      c.height = c.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [phase]);

  // ── Render loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "active" && phase !== "confirmed") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = (ts: number) => {
      const t  = ts / 1000;
      timeRef.current = t;
      // Ensure canvas has valid internal dimensions (may be 0 on first frame)
      if (!canvas.width || !canvas.height) {
        canvas.width  = canvas.clientWidth  || canvas.offsetWidth  || 390;
        canvas.height = canvas.clientHeight || canvas.offsetHeight || 844;
      }
      const W  = canvas.width, H = canvas.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { frameRef.current = requestAnimationFrame(render); return; }

      ctx.clearRect(0, 0, W, H);
      const am = detectAngleMode(orientRef.current.beta, orientRef.current.gamma);

      // Gallery mode: draw the photo onto canvas as the base layer
      if (captureMode === "gallery") {
        const img = galleryImgRef.current;
        if (img && img.naturalWidth > 0) {
          const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
          const dw = img.naturalWidth * scale;
          const dh = img.naturalHeight * scale;
          const dx = (W - dw) / 2;
          const dy = (H - dh) / 2;
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, W, H);
          ctx.drawImage(img, dx, dy, dw, dh);
        } else {
          ctx.fillStyle = "#111827";
          ctx.fillRect(0, 0, W, H);
        }
      }

      if (phase === "active") {
        if (captureMode === "live") drawPerspectiveGrid(ctx, W, H, t, am);
        if (cornersRef.current.length === 0) drawRadar(ctx, W, H, t);
        drawPolygon(ctx, cornersRef.current, t);
        cornersRef.current.forEach((c, i) => drawCorner(ctx, c, i, t));
        drawDimensions(ctx, cornersRef.current);
        drawAxisHint(ctx, W, H, cornersRef.current);
        drawNextGuide(ctx, W, H, cornersRef.current.length);
        drawInstructions(ctx, W, H, cornersRef.current.length);
        if (captureMode === "live") {
          drawAngleBadge(ctx, W, am);
          drawTipBanner(ctx, W, am);
          // ArUco marker overlay
          if (arucoDetRef.current) {
            drawArucoOverlay(ctx, arucoDetRef.current, 0.10);
          }
        }
      } else {
        drawPolygon(ctx, cornersRef.current, t);
        cornersRef.current.forEach((c, i) => drawCorner(ctx, c, i, t));
        drawDimensions(ctx, cornersRef.current);
        drawConfirmedOverlay(ctx, W, H);
      }
      frameRef.current = requestAnimationFrame(render);
    };
    frameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase, captureMode]);

  // Cleanup
  useEffect(() => () => stopCamera(), [stopCamera]);

  // ── Measurement ────────────────────────────────────────────────────────────
  const computeResult = useCallback((cs: ScreenCorner[]) => {
    if (cs.length < 3) { resultRef.current = null; return; }
    resultRef.current = buildMeasurementResult({
      points: cs.map(c => c.world),
      trackingQuality: orientRef.current.hasData ? "good" : "limited",
      updates: cs.length,
    });
  }, []);

  // ── Pointer handlers ───────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== "active") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Drag existing corner?
    let nearest = -1, nearDist = 32;
    cornersRef.current.forEach((c, i) => {
      const d = dist2D(sx, sy, c.x, c.y);
      if (d < nearDist) { nearest = i; nearDist = d; }
    });
    if (nearest >= 0) {
      dragRef.current = nearest;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (cornersRef.current.length >= 4) return;

    // ── World position calculation ──────────────────────────────────────────
    let worldSx = sx, worldSy = sy, worldW = canvas.width, worldH = canvas.height;
    let beta: number, gamma: number;

    if (captureMode === "gallery" && galleryImgRef.current) {
      // Gallery mode: correct for objectFit:contain letterboxing.
      // Reject taps in the black bar areas outside the rendered image.
      const bounds = getContainedImageBoundsOnCanvas(galleryImgRef.current, canvas.width, canvas.height);
      if (sx < bounds.left || sx > bounds.left + bounds.width ||
          sy < bounds.top  || sy > bounds.top  + bounds.height) {
        return; // tap outside the actual image — ignore
      }
      // Map to image-relative coordinates so screenToWorld FOV math is correct
      worldSx = sx - bounds.left;
      worldSy = sy - bounds.top;
      worldW  = bounds.width;
      worldH  = bounds.height;
      beta    = galleryBeta;
      gamma   = 0;
    } else {
      beta  = orientRef.current.beta;
      gamma = orientRef.current.gamma;
    }

    const world = screenToWorld(worldSx, worldSy, worldW, worldH, beta, gamma);
    // ArUco scale correction: if marker detected, rescale world coordinates
    if (arucoScaleRef.current !== null && captureMode === "live") {
      const hFovRad  = (65 * Math.PI) / 180;
      const camH     = beta < 30 ? 1.8 : beta < 55 ? 1.6 : beta < 70 ? 1.3 : 1.0;
      const theoryMpp = (2 * camH * Math.tan(hFovRad / 2)) / worldW;
      const factor    = arucoScaleRef.current / theoryMpp;
      world.x *= factor;
      world.z *= factor;
    }
    const idx   = cornersRef.current.length;
    // Store screen-space (sx, sy) for drawing; world position for measurement
    const newCorner: ScreenCorner = { x: sx, y: sy, world, label: CORNER_LABELS[idx]! };
    const updated = [...cornersRef.current, newCorner];
    setCorners(updated);
    computeResult(updated);
  }, [phase, captureMode, galleryBeta, computeResult]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current === null || phase !== "active") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    let worldSx = sx, worldSy = sy, worldW = canvas.width, worldH = canvas.height;
    let beta: number, gamma: number;

    if (captureMode === "gallery" && galleryImgRef.current) {
      const bounds = getContainedImageBoundsOnCanvas(galleryImgRef.current, canvas.width, canvas.height);
      // Clamp drag within image area
      worldSx = Math.max(0, Math.min(bounds.width,  sx - bounds.left));
      worldSy = Math.max(0, Math.min(bounds.height, sy - bounds.top));
      worldW  = bounds.width;
      worldH  = bounds.height;
      beta    = galleryBeta;
      gamma   = 0;
    } else {
      beta  = orientRef.current.beta;
      gamma = orientRef.current.gamma;
    }

    const world = screenToWorld(worldSx, worldSy, worldW, worldH, beta, gamma);
    // ArUco scale correction
    if (arucoScaleRef.current !== null && captureMode === "live") {
      const hFovRad   = (65 * Math.PI) / 180;
      const camH      = beta < 30 ? 1.8 : beta < 55 ? 1.6 : beta < 70 ? 1.3 : 1.0;
      const theoryMpp = (2 * camH * Math.tan(hFovRad / 2)) / worldW;
      const factor    = arucoScaleRef.current / theoryMpp;
      world.x *= factor;
      world.z *= factor;
    }
    setCorners(prev => {
      const updated = prev.map((c, i) => i === dragRef.current ? { ...c, x: sx, y: sy, world } : c);
      computeResult(updated);
      return updated;
    });
  }, [phase, captureMode, galleryBeta, computeResult]);

  const handlePointerUp = useCallback(() => { dragRef.current = null; }, []);

  // ── Confirm ────────────────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    const result = resultRef.current;
    if (!result) return;

    // Capture photo: live camera frame, frozen live capture, OR gallery image
    let capturedPhoto: string | null = null;
    if (captureMode === "live" && videoRef.current) {
      capturedPhoto = captureVideoFrame(videoRef.current);
    } else if (captureMode === "gallery") {
      capturedPhoto = capturedLiveFrame ?? galleryPhoto;
    }

    // Crop to the quadrilateral defined by the 4 AR corner dots
    const corners = cornersRef.current;
    if (capturedPhoto && corners.length >= 3) {
      const canvas = canvasRef.current;
      const canvasW = canvas?.width  || 390;
      const canvasH = canvas?.height || 844;
      try {
        capturedPhoto = await cropPhotoToCorners(
          capturedPhoto,
          corners,
          canvasW,
          canvasH,
          captureMode,
          videoRef.current   ?? undefined,
          galleryImgRef.current ?? undefined,
        );
      } catch { /* fallback: use full photo */ }
    }

    setPhase("confirmed");
    setApplying(true);
    const projectInput = liveARMeasurementToProjectInput(result, { spaceType: "rooftop", floorLevel: 1 });

    try {
      if (photoSessionId) {
        await fetch("/api/photo-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: photoSessionId,
            photoSession: {
              projectId,
              widthM:    projectInput.widthM,
              lengthM:   projectInput.lengthM,
              floorLevel: projectInput.floorLevel,
              measurementStatus: captureMode === "gallery" ? "measured_gallery_ar" : "measured_live_ar",
              measurementCompletedAt: new Date().toISOString(),
            },
          }),
        });
      }
    } catch { /* best-effort */ }

    setApplying(false);
    setConfirmDone(true);
    setTimeout(() => onApplied({ measurement: result, projectInput, capturedPhoto }), 900);
  }, [captureMode, galleryPhoto, photoSessionId, projectId, onApplied]);

  // ─────────────────────────────────────────────────────────────────────────
  const S: Record<string, React.CSSProperties> = {
    root:       { position: "fixed", inset: 0, background: C.bg, display: "flex", flexDirection: "column", fontFamily: "'DM Sans', sans-serif", color: C.text },
    fullCamera: { position: "absolute", inset: 0, display: "flex", flexDirection: "column" },
    video:      { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
    galleryImg: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#000" },
    canvas:     { position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none" },
    topBar:     { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, paddingTop: "calc(env(safe-area-inset-top, 44px) + 12px)", paddingBottom: "12px", paddingLeft: "20px", paddingRight: "20px", background: "linear-gradient(to bottom, rgba(9,22,14,0.85) 0%, transparent 100%)", display: "flex", alignItems: "center", justifyContent: "space-between" },
    bottomBar:  { position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20, padding: "16px 20px 40px", background: "linear-gradient(to top, rgba(9,22,14,0.92) 0%, transparent 100%)", display: "flex", flexDirection: "column", gap: 10 },
    btn:        { border: "none", borderRadius: 14, padding: "14px 0", fontWeight: 700, fontSize: 14, letterSpacing: ".5px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
    btnPrimary: { background: "linear-gradient(135deg,#1B4332,#2D6A4F,#40916C)", color: "#fff", boxShadow: "0 4px 16px rgba(45,106,79,.35)" },
    btnGhost:   { background: "#fff", color: C.textDim, border: "1px solid rgba(0,0,0,0.10)" },
    btnGallery: { background: C.cardGreen, color: C.green, border: `1px solid ${C.greenGlow}` },
    badge:      { display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", background: C.greenDim, color: C.green, border: `1px solid ${C.greenGlow}` },
  };

  // ══════════════════════════════════════════════════════════════════════════
  // INTRO SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === "intro") {
    return (
      <div style={S.root}>
        {/* hidden file input */}
        <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" style={{ display: "none" }} onChange={handleFileSelect} />
        {/* Converting overlay shown while HEIC → JPEG conversion runs */}
        {converting && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(242,243,247,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, zIndex: 50 }}>
            <div style={{ fontSize: 36 }}>🔄</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#2D6A4F" }}>Converting HEIC…</div>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>This may take a few seconds</div>
          </div>
        )}
        {/* Invisible 1×1 img — only needed to trigger conversion; loading is handled by useEffect */}

        <div style={{ position: "absolute", top: -80, right: -60, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(45,106,79,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "56px 24px 24px", overflowY: "auto" }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <span style={S.badge}>LIVE AR</span>
              <span style={{ ...S.badge, background: C.skyDim, color: C.sky, border: `1px solid rgba(64,145,108,0.30)` }}>GALLERY</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, color: "#111827" }}>
              Measure Your<br /><span style={{ color: C.green }}>Rooftop in AR</span>
            </div>
            <div style={{ fontSize: 13, color: C.textDim, marginTop: 8, lineHeight: 1.5 }}>
              Use live camera or pick a photo from your gallery. Tap 4 corners to measure.
            </div>
          </div>

          {/* Steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {[
              { n: "01", icon: "📷", t: "Camera or Gallery",  d: "Use live AR or pick a rooftop photo from your gallery." },
              { n: "02", icon: "📍", t: "Tap 4 Corners",       d: "Tap each rooftop corner. Drag to fine-tune position." },
              { n: "03", icon: "📐", t: "Perspective Math",    d: "AI corrects for tilt, roll, and angle automatically." },
              { n: "04", icon: "✅", t: "Confirm & Use",        d: "Measurement applied to your garden plan instantly." },
            ].map(s => (
              <div key={s.n} style={{ display: "flex", gap: 12, padding: "12px 14px", borderRadius: 12, background: "#fff", border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: 20 }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 10, color: C.green, fontWeight: 700, letterSpacing: "1px", marginBottom: 2 }}>STEP {s.n} · {s.t.toUpperCase()}</div>
                  <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.4 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Angle scenarios */}
          <div style={{ padding: "12px 14px", borderRadius: 12, background: C.cardGreen, border: `1px solid ${C.greenGlow}`, marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: C.green, fontWeight: 700, letterSpacing: "1.5px", marginBottom: 8 }}>WORKS IN ALL ANGLES</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {(Object.entries(ANGLE_META) as [AngleMode, typeof ANGLE_META[AngleMode]][]).map(([key, m]) => (
                <div key={key} style={{ textAlign: "center", padding: "6px 4px", borderRadius: 8, background: "rgba(255,255,255,0.75)" }}>
                  <div style={{ fontSize: 16 }}>{m.icon}</div>
                  <div style={{ fontSize: 8, color: m.color, fontWeight: 700, letterSpacing: "1px", marginTop: 2 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: "10px 14px", borderRadius: 10, background: C.greenDim, border: `1px solid ${C.greenGlow}` }}>
            <div style={{ fontSize: 11, color: C.green, lineHeight: 1.5 }}>
              💡 Tip: For the gallery mode, use a photo taken from a high vantage point where all 4 corners are visible.
            </div>
          </div>
        </div>

        <div style={{ padding: "0 24px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
          <button style={{ ...S.btn, ...S.btnPrimary }} onClick={startCamera}>
            📷  START LIVE AR SCAN
          </button>
          <button style={{ ...S.btn, ...S.btnGallery }} onClick={openGallery}>
            🖼  SCAN FROM GALLERY
          </button>
          <button style={{ ...S.btn, ...S.btnGhost }} onClick={onCancel}>CANCEL</button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REQUESTING
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === "requesting") {
    return (
      <div style={{ ...S.root, alignItems: "center", justifyContent: "center", gap: 20 }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 68, height: 68, borderRadius: "50%", border: "2px solid rgba(82,183,136,0.3)", borderTopColor: C.green, animation: "spin 1s linear infinite" }} />
        <div style={{ fontSize: 16, color: C.green, fontWeight: 600 }}>Accessing camera…</div>
        <div style={{ fontSize: 13, color: C.textDim }}>Allow camera permission when prompted</div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ERROR
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === "error") {
    return (
      <div style={{ ...S.root, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
        <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" style={{ display: "none" }} onChange={handleFileSelect} />
        <div style={{ fontSize: 40 }}>📷</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.heat }}>Camera Unavailable</div>
        <div style={{ fontSize: 13, color: C.textDim, textAlign: "center", lineHeight: 1.5 }}>
          {cameraErr || "Could not access the camera. Check permissions and try again."}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 8 }}>
          <button style={{ ...S.btn, ...S.btnGallery }} onClick={openGallery}>
            🖼  USE GALLERY PHOTO INSTEAD
          </button>
          <button style={{ ...S.btn, ...S.btnPrimary }} onClick={startCamera}>TRY CAMERA AGAIN</button>
          <button style={{ ...S.btn, ...S.btnGhost }} onClick={onCancel}>GO BACK</button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ACTIVE / CONFIRMED — fullscreen feed + canvas overlay
  // ══════════════════════════════════════════════════════════════════════════
  const canConfirm = corners.length >= 3 && phase === "active";
  const canReset   = corners.length > 0  && phase === "active";
  const am = angleMode;

  return (
    <div style={S.root}>
      {/* Hidden file input for gallery switch */}
      <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" style={{ display: "none" }} onChange={handleFileSelect} />

      <div style={S.fullCamera}>
        {/* Feed: live video OR gallery image */}
        {captureMode === "live" && (
          <video ref={videoRef} style={S.video} playsInline muted autoPlay />
        )}
        {captureMode === "gallery" && (capturedLiveFrame || galleryPhoto) && (
          <img
            ref={imgRef}
            src={capturedLiveFrame ?? galleryPhoto!}
            alt=""
            style={S.galleryImg}
            onLoad={() => { if (imgRef.current) galleryImgRef.current = imgRef.current; }}
          />
        )}

        {/* ── Capture flash overlay ─────────────────────────────────────── */}
        {captureFlash && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(255,255,255,0.85)",
            zIndex: 50, pointerEvents: "none",
            animation: "hw-flash 0.28s ease-out forwards",
          }} />
        )}
        <style>{`
          @keyframes hw-flash {
            0%   { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes hw-shutter-ring {
            0%   { transform: scale(1);   opacity: 1; }
            100% { transform: scale(1.5); opacity: 0; }
          }
        `}</style>

        {/* AR overlay canvas */}
        <canvas
          ref={canvasRef}
          style={S.canvas}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div style={S.topBar}>
          {/* Back — fixed width so it never collapses */}
          <button
            onClick={onCancel}
            style={{ ...S.btn, padding: "8px 14px", fontSize: 12, background: "rgba(9,22,14,0.75)", color: "rgba(216,243,220,0.75)", border: "1px solid rgba(82,183,136,0.22)", borderRadius: 12, flexShrink: 0 }}
          >
            ← Back
          </button>

          {/* Centre: mode badge + live area — flex:1 so it uses available space only */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, overflow: "hidden", padding: "0 8px" }}>
            {/* Mode pill */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, maxWidth: "100%" }}>
              {phase !== "confirmed" && (
                <span style={{
                  width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                  background: captureMode === "gallery" ? C.sky : "#52B788",
                  boxShadow: captureMode === "gallery" ? "0 0 6px rgba(64,145,108,0.8)" : "0 0 6px rgba(82,183,136,0.9)",
                  display: "inline-block",
                }} />
              )}
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: phase === "confirmed" ? "#52B788" : capturedLiveFrame ? "#52B788" : captureMode === "gallery" ? C.sky : "rgba(216,243,220,0.95)" }}>
                {phase === "confirmed" ? "✓ CONFIRMED" : capturedLiveFrame ? "FROZEN FRAME" : captureMode === "gallery" ? "GALLERY MODE" : "LIVE SCAN"}
              </span>
            </div>
            {/* ArUco marker detection badge */}
            {arucoDetected && captureMode === "live" && phase === "active" && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,255,136,0.15)", border: "1px solid rgba(0,255,136,0.4)", borderRadius: 10, padding: "2px 8px" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#00FF88", boxShadow: "0 0 5px #00FF88", display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: "1.2px", color: "#00FF88", whiteSpace: "nowrap" }}>SCALE LOCKED</span>
              </div>
            )}
            {/* Live area readout */}
            {corners.length >= 3 && resultRef.current?.polygon && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: "#52B788", lineHeight: 1 }}>
                  {resultRef.current.polygon.areaSqM.toFixed(1)}
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(82,183,136,0.7)", letterSpacing: "1px" }}>m²</span>
              </div>
            )}
          </div>

          {/* Right: gallery switch + reset + re-shoot — fixed width */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {/* Re-shoot: shown when frame is frozen from live capture */}
            {capturedLiveFrame && captureMode === "gallery" && phase === "active" && (
              <button
                onClick={() => {
                  setCapturedLiveFrame(null);
                  setCorners([]);
                  resultRef.current = null;
                  startCamera();
                }}
                style={{ ...S.btn, padding: "7px 10px", fontSize: 11, fontWeight: 700, background: "rgba(82,183,136,0.15)", color: "#52B788", border: "1px solid rgba(82,183,136,0.35)", borderRadius: 12, letterSpacing: "0.3px" }}
                title="Return to live camera"
              >
                ↩ Live
              </button>
            )}
            {captureMode === "live" && phase === "active" && (
              <button
                onClick={openGallery}
                style={{ ...S.btn, padding: "7px 11px", fontSize: 13, background: "rgba(64,145,108,0.15)", color: C.sky, border: "1px solid rgba(64,145,108,0.30)", borderRadius: 12 }}
                title="Use photo from gallery"
              >
                🖼
              </button>
            )}
            {canReset && (
              <button
                onClick={() => { setCorners([]); resultRef.current = null; }}
                style={{ ...S.btn, padding: "7px 11px", fontSize: 11, fontWeight: 700, background: "rgba(231,111,81,0.12)", color: "rgba(231,111,81,0.9)", border: "1px solid rgba(231,111,81,0.28)", borderRadius: 12, letterSpacing: "0.5px" }}
              >
                ↺ Reset
              </button>
            )}
            {!canReset && !captureMode.includes("gallery") && <div style={{ width: 56 }} />}
          </div>
        </div>

        {/* ── Bottom bar ──────────────────────────────────────────────────── */}
        <div style={S.bottomBar}>

          {/* ── Corner progress tracker ─────────────────────────────────── */}
          {phase === "active" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              {/* Row of dots with connector lines */}
              <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                {CORNER_LABELS.map((lbl, i) => {
                  const placed   = corners.length > i;
                  const isNext   = corners.length === i;
                  const color    = CORNER_COLORS[i]!;
                  return (
                    <React.Fragment key={lbl}>
                      {/* Connector line between dots */}
                      {i > 0 && (
                        <div style={{
                          width: 28, height: 2, borderRadius: 1,
                          background: corners.length >= i
                            ? `linear-gradient(to right, ${CORNER_COLORS[i - 1]}, ${color})`
                            : "rgba(255,255,255,0.10)",
                          transition: "background .4s",
                        }} />
                      )}
                      {/* Corner dot */}
                      <div style={{
                        width: isNext ? 38 : 32, height: isNext ? 38 : 32,
                        borderRadius: "50%",
                        background: placed
                          ? color.replace("1)", "0.22)")
                          : isNext
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(255,255,255,0.04)",
                        border: `${isNext ? 2.5 : 2}px solid ${placed ? color : isNext ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.15)"}`,
                        boxShadow: isNext ? `0 0 10px rgba(255,255,255,0.18)` : placed ? `0 0 8px ${color.replace("1)", "0.35)")}` : "none",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: placed ? 13 : 12, fontWeight: 800,
                        color: placed ? color : isNext ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.22)",
                        transition: "all .3s",
                        flexShrink: 0,
                      }}>
                        {placed ? "✓" : lbl}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* "Tap corner X" instruction under dots */}
              {corners.length < 4 && (
                <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(216,243,220,0.7)", letterSpacing: "0.3px" }}>
                  {corners.length === 0
                    ? "Tap corner  A  to start"
                    : `Tap corner  ${CORNER_LABELS[corners.length]}  next`}
                </div>
              )}
              {corners.length === 4 && !canConfirm && (
                <div style={{ fontSize: 12, fontWeight: 600, color: "#52B788" }}>All 4 corners placed!</div>
              )}
            </div>
          )}

          {/* ── Angle guidance (live mode only) ────────────────────────── */}
          {captureMode === "live" && phase === "active" && (
            <div style={{ background: "rgba(9,22,14,0.55)", borderRadius: 14, padding: "8px 12px", border: "1px solid rgba(82,183,136,0.12)" }}>
              {/* Active angle tip */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{ANGLE_META[am].icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", color: ANGLE_META[am].color }}>{ANGLE_META[am].label}</div>
                  <div style={{ fontSize: 10, color: "rgba(216,243,220,0.55)", marginTop: 1 }}>{ANGLE_META[am].tip}</div>
                </div>
              </div>
              {/* Mini angle strip */}
              <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                {(["overhead","high","mid","low","horizontal"] as AngleMode[]).map(key => {
                  const active = am === key;
                  return (
                    <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, opacity: active ? 1 : 0.3, transition: "opacity .3s" }}>
                      <div style={{ width: active ? 28 : 22, height: active ? 28 : 22, borderRadius: "50%", background: active ? ANGLE_META[key].color.replace("1)", "0.18)") : "transparent", border: `1.5px solid ${active ? ANGLE_META[key].color : "rgba(255,255,255,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: active ? 13 : 11, transition: "all .3s" }}>
                        {ANGLE_META[key].icon}
                      </div>
                      <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: "0.4px", color: active ? ANGLE_META[key].color : "rgba(216,243,220,0.35)" }}>
                        {ANGLE_META[key].label.split(" ")[0]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Gallery angle picker ────────────────────────────────────── */}
          {captureMode === "gallery" && phase === "active" && (() => {
            const gam = detectAngleMode(galleryBeta, 0);
            const GALLERY_ANGLES: { label: string; icon: string; beta: number; key: AngleMode }[] = [
              { label: "OVERHEAD", icon: "⬇", beta: 20,  key: "overhead" },
              { label: "HIGH",     icon: "↙", beta: 42,  key: "high"     },
              { label: "MID",      icon: "↘", beta: 60,  key: "mid"      },
              { label: "LOW",      icon: "→", beta: 76,  key: "low"      },
            ];
            return (
              <div style={{ background: "rgba(9,22,14,0.55)", borderRadius: 14, padding: "8px 12px", border: "1px solid rgba(64,145,108,0.18)" }}>
                <div style={{ textAlign: "center", fontSize: 9, color: C.sky, letterSpacing: "1.5px", fontWeight: 800, marginBottom: 8 }}>
                  🖼  HOW WAS THE PHOTO TAKEN?
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                  {GALLERY_ANGLES.map(ga => {
                    const active = gam === ga.key;
                    return (
                      <button
                        key={ga.key}
                        onClick={() => { setGalleryBeta(ga.beta); setCorners([]); resultRef.current = null; }}
                        style={{ border: `1.5px solid ${active ? C.sky : "rgba(64,145,108,0.22)"}`, borderRadius: 12, padding: "7px 10px", background: active ? "rgba(64,145,108,0.2)" : "rgba(9,22,14,0.5)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 54, boxShadow: active ? "0 0 10px rgba(64,145,108,0.25)" : "none", transition: "all .2s" }}
                      >
                        <span style={{ fontSize: 16 }}>{ga.icon}</span>
                        <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: "0.8px", color: active ? C.sky : "rgba(64,145,108,0.5)" }}>{ga.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ textAlign: "center", fontSize: 9, color: "rgba(216,243,220,0.3)", marginTop: 6, letterSpacing: "0.3px" }}>
                  Select the angle that matches how the photo was taken · changing angle resets corners
                </div>
              </div>
            );
          })()}

          {/* ── Live capture shutter button ─────────────────────────────── */}
          {captureMode === "live" && phase === "active" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 4, paddingBottom: 2 }}>
              {/* Outer label row */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", color: "rgba(216,243,220,0.45)" }}>
                  CAPTURE & MEASURE
                </div>
                {/* Shutter button — classic camera ring design */}
                <button
                  onClick={handleCaptureLive}
                  style={{
                    position: "relative",
                    width: 72, height: 72,
                    borderRadius: "50%",
                    border: "3px solid rgba(255,255,255,0.90)",
                    background: "rgba(255,255,255,0.0)",
                    cursor: "pointer",
                    padding: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 0 2px rgba(255,255,255,0.25), 0 4px 24px rgba(0,0,0,0.35)",
                    WebkitTapHighlightColor: "transparent",
                    transition: "transform .1s, box-shadow .1s",
                  }}
                  onPointerDown={e => (e.currentTarget.style.transform = "scale(0.93)")}
                  onPointerUp={e => (e.currentTarget.style.transform = "scale(1)")}
                  onPointerLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                  title="Capture frame and measure"
                >
                  {/* Inner white disc */}
                  <div style={{
                    width: 52, height: 52, borderRadius: "50%",
                    background: "rgba(255,255,255,0.95)",
                    boxShadow: "0 0 12px rgba(255,255,255,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 20 }}>📷</span>
                  </div>
                </button>
                <div style={{ fontSize: 9, color: "rgba(216,243,220,0.35)", letterSpacing: "0.5px" }}>
                  {corners.length > 0 ? "Freeze frame · keep corners" : "Freeze frame to pin corners"}
                </div>
              </div>
            </div>
          )}

          {/* ── Confirm / status ────────────────────────────────────────── */}
          {canConfirm && (
            <button style={{ ...S.btn, ...S.btnPrimary, fontSize: 15, letterSpacing: "0.8px" }} onClick={handleConfirm} disabled={applying || confirmDone}>
              {applying ? "SAVING…" : confirmDone ? "✓ CONFIRMED" : `CONFIRM  ${resultRef.current?.polygon?.areaSqM.toFixed(1) ?? "—"} m²  →`}
            </button>
          )}
          {phase === "confirmed" && !confirmDone && (
            <div style={{ textAlign: "center", fontSize: 14, color: "#52B788", fontWeight: 700 }}>Saving measurement…</div>
          )}
        </div>
      </div>
    </div>
  );
}
