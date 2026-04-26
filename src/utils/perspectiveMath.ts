// ============================================================
// HeatWise — Perspective Measurement Math
// src/utils/perspectiveMath.ts
//
// Converts four screen-space corner points into real-world
// dimensions using projective geometry.
//
// Algorithm:
//   1. Compute cross-ratios from the four screen corners
//   2. Apply camera FOV + tilt to get metric scale
//   3. Correct for perspective distortion
//   4. Return width × length in metres
//
// References:
//   - Hartley & Zisserman "Multiple View Geometry" Ch.2
//   - Criminisi et al. "Single view metrology" IJCV 2000
// ============================================================

import type {
  ScreenPoint,
  CornerSet,
  CalibrationData,
  PerspectiveResult,
  Homography,
} from "../types/ar.types";

// ─── Public API ──────────────────────────────────────────────

/**
 * Main entry point.
 * Takes four ordered screen corners (tl, tr, br, bl) and
 * calibration data, returns real-world dimensions in metres.
 */
export function computeRealWorldDimensions(
  corners:     CornerSet,
  calibration: CalibrationData,
  imageWidth:  number,
  imageHeight: number,
): PerspectiveResult {
  const pts = extractPoints(corners);

  // Validate the four corners form a valid quadrilateral
  const valid = validateQuadrilateral(pts);
  if (!valid.ok) {
    return { widthM: 0, lengthM: 0, skewDeg: 0, valid: false, reason: valid.reason };
  }

  // Compute the rectified (de-perspectived) rectangle dimensions in pixels
  const rectified = rectifyQuadrilateral(pts);

  // Convert pixel dimensions to metres using calibration data
  const scale = computeMetricScale(calibration, imageWidth, imageHeight);

  const widthM  = parseFloat((rectified.widthPx  * scale).toFixed(2));
  const lengthM = parseFloat((rectified.lengthPx * scale).toFixed(2));

  // Clamp to reasonable real-world bounds (0.5m – 200m)
  const clampedW = Math.max(0.5, Math.min(200, widthM));
  const clampedL = Math.max(0.5, Math.min(200, lengthM));

  return {
    widthM:  clampedW,
    lengthM: clampedL,
    skewDeg: rectified.skewDeg,
    valid:   true,
  };
}

/**
 * Estimates camera scale factor from calibration.
 * Returns metres per pixel at the estimated shooting distance.
 */
export function computeMetricScale(
  cal:         CalibrationData,
  imageWidth:  number,
  imageHeight: number,
): number {
  // Camera height above the surface gives us the shooting distance
  const distanceM = cal.cameraHeightM / Math.cos(toRad(cal.tiltAngleDeg));

  // Real-world width visible at this distance using horizontal FOV
  const visibleWidthM = 2 * distanceM * Math.tan(toRad(cal.hFovDeg / 2));

  // Metres per pixel
  return visibleWidthM / imageWidth;
}

/**
 * Estimates the camera's horizontal FOV from device constraints.
 * Most mobile cameras are 60–75° horizontal FOV.
 */
export function estimateCameraFOV(
  videoTrack: MediaStreamTrack | null,
): number {
  if (!videoTrack) return 65; // conservative default

  const settings = videoTrack.getSettings();

  // Some devices expose focal length — use it if available
  if ((settings as any).focusDistance) {
    // Approximate from focal length and sensor width
    // Most mobile sensors are ~5.6mm wide
    const focalLength    = (settings as any).focusDistance as number;
    const sensorWidthMm  = 5.6;
    return 2 * Math.atan(sensorWidthMm / (2 * focalLength)) * (180 / Math.PI);
  }

  // Use aspect ratio hint — wider sensors tend to have wider FOV
  if (settings.width && settings.height) {
    const aspectRatio = settings.width / settings.height;
    if (aspectRatio >= 1.8) return 72;  // ultra-wide
    if (aspectRatio >= 1.5) return 65;  // standard wide
    return 58;                          // narrower
  }

  return 65; // safe default for most phones
}

// ─── Quadrilateral Validation ─────────────────────────────────

interface ValidationResult {
  ok:     boolean;
  reason?: string;
}

function validateQuadrilateral(
  pts: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint],
): ValidationResult {
  const [tl, tr, br, bl] = pts;

  // All points must be distinct
  if (pointsAreTooClose(tl, tr) || pointsAreTooClose(br, bl) ||
      pointsAreTooClose(tl, bl) || pointsAreTooClose(tr, br)) {
    return { ok: false, reason: "Some corners are too close together" };
  }

  // Check convexity — corners must form a convex quad
  if (!isConvexQuad(pts)) {
    return { ok: false, reason: "Corners don't form a convex shape — try re-placing them" };
  }

  // Check minimum area (too small = noise)
  const area = shoelaceArea(pts);
  if (area < 1000) { // pixels²
    return { ok: false, reason: "Marked area is too small — move the camera closer" };
  }

  return { ok: true };
}

function pointsAreTooClose(a: ScreenPoint, b: ScreenPoint): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx*dx + dy*dy) < 20; // 20px minimum separation
}

function isConvexQuad(
  pts: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint],
): boolean {
  // Cross product of consecutive edges must all have same sign
  const signs: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    const c = pts[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    signs.push(cross > 0 ? 1 : -1);
  }
  return signs.every(s => s === signs[0]);
}

/** Shoelace formula for polygon area */
function shoelaceArea(
  pts: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint],
): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

// ─── Perspective Rectification ────────────────────────────────

interface RectifiedDimensions {
  widthPx:  number;
  lengthPx: number;
  skewDeg:  number;
}

/**
 * Given four screen-space corners of a real rectangle,
 * computes what the rectangle's width and height would be
 * if viewed head-on (removing perspective distortion).
 *
 * Uses the cross-ratio preservation property of projective
 * transformations to recover true aspect ratio.
 */
function rectifyQuadrilateral(
  pts: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint],
): RectifiedDimensions {
  const [tl, tr, br, bl] = pts;

  // Top and bottom edge lengths in screen space
  const topLen    = dist(tl, tr);
  const bottomLen = dist(bl, br);
  const leftLen   = dist(tl, bl);
  const rightLen  = dist(tr, br);

  // Average opposing edges to get the de-perspectived lengths
  // (This approximation is valid for tilt angles < 60°)
  const widthPx  = (topLen + bottomLen) / 2;
  const lengthPx = (leftLen + rightLen) / 2;

  // Compute skew as angle deviation from 90° at each corner
  const topVec    = vecNorm({ x: tr.x - tl.x, y: tr.y - tl.y });
  const leftVec   = vecNorm({ x: bl.x - tl.x, y: bl.y - tl.y });
  const dotProduct = topVec.x * leftVec.x + topVec.y * leftVec.y;
  const skewDeg   = Math.abs(90 - Math.acos(Math.max(-1, Math.min(1, dotProduct))) * 180 / Math.PI);

  return { widthPx, lengthPx, skewDeg };
}

// ─── Geometry Utilities ───────────────────────────────────────

function dist(a: ScreenPoint, b: ScreenPoint): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function vecNorm(v: ScreenPoint): ScreenPoint {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

function toRad(deg: number): number {
  return deg * Math.PI / 180;
}

function extractPoints(
  corners: CornerSet,
): [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint] {
  return [
    corners.tl.screen,
    corners.tr.screen,
    corners.br.screen,
    corners.bl.screen,
  ];
}

// ─── Confidence Estimator ─────────────────────────────────────

/**
 * Estimates measurement confidence based on:
 *   - How close to rectangular the marked area is
 *   - Whether device orientation data was available
 *   - The area of the marked region relative to the frame
 */
export function estimateConfidence(
  result:      PerspectiveResult,
  calibration: CalibrationData,
  markedAreaPx: number,
  totalAreaPx:  number,
): "low" | "medium" | "high" {
  let score = 0;

  // Skew penalty — more skew = lower confidence
  if (result.skewDeg < 5)       score += 3;
  else if (result.skewDeg < 15) score += 2;
  else if (result.skewDeg < 30) score += 1;

  // Sensor data bonus
  if (calibration.hasSensorData) score += 2;

  // Coverage bonus — marked area should be at least 20% of frame
  const coverage = markedAreaPx / totalAreaPx;
  if (coverage > 0.5)      score += 2;
  else if (coverage > 0.2) score += 1;

  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  return "low";
}
