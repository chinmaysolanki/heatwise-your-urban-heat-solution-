// ============================================================
// HeatWise — ArUco-based metric scale solver
// src/utils/arucoScaling.ts
//
// How it works:
//   1. js-aruco detects a printed ArUco marker in a video frame
//   2. We measure the marker's size in pixels
//   3. Knowing its physical size (default 10 cm), we derive
//      metres-per-pixel — replacing the FOV+height estimate
//   4. This scale is fed back into the AR measurement engine
//
// Accuracy:  ±2–3 % (vs ±10–15 % from monocular FOV estimate)
// Marker:    DICT_4X4_50, ID 0–49  (print at EXACT physical size)
// Recommend: print marker #0 at 10 cm × 10 cm on white paper
// ============================================================

// Dynamic import so the WASM-free js-aruco loads client-side only
let _AR: any = null;
async function getAR() {
  if (_AR) return _AR;
  _AR = await import("js-aruco");
  return _AR;
}

export interface ArucoDetection {
  /** Marker ID (0–49 for DICT_4X4_50) */
  id: number;
  /** Marker side length in pixels (average of 4 edges) */
  sidePx: number;
  /** Derived metres-per-pixel using the known physical marker size */
  metresPerPixel: number;
  /** Centre of the marker in image coordinates */
  cx: number;
  cy: number;
  /** Raw corner array from js-aruco */
  corners: Array<{ x: number; y: number }>;
}

export interface ArucoScaleResult {
  detected: boolean;
  detection?: ArucoDetection;
  /** Scale to use in measurement (from ArUco if detected, else null) */
  metresPerPixel: number | null;
}

/**
 * Runs ArUco detection on a single ImageData frame.
 * Returns the best (largest) detected marker.
 *
 * @param imageData  ImageData from canvas.getContext("2d").getImageData(...)
 * @param markerSizeM  Physical size of the printed marker side, metres (default 0.10 = 10 cm)
 */
export async function detectArucoScale(
  imageData: ImageData,
  markerSizeM = 0.10,
): Promise<ArucoScaleResult> {
  try {
    const AR = await getAR();
    const detector = new AR.AR.Detector();
    const markers: any[] = detector.detect(imageData);

    if (!markers || markers.length === 0) {
      return { detected: false, metresPerPixel: null };
    }

    // Pick the largest marker (most pixels → most accurate scale)
    const best = markers.reduce((a: any, b: any) => {
      return avgSide(a.corners) >= avgSide(b.corners) ? a : b;
    });

    const sidePx = avgSide(best.corners);
    if (sidePx < 20) {
      // Marker too small in frame — too far away, unreliable
      return { detected: false, metresPerPixel: null };
    }

    const metresPerPixel = markerSizeM / sidePx;
    const cx = best.corners.reduce((s: number, c: any) => s + c.x, 0) / 4;
    const cy = best.corners.reduce((s: number, c: any) => s + c.y, 0) / 4;

    return {
      detected: true,
      metresPerPixel,
      detection: {
        id: best.id,
        sidePx,
        metresPerPixel,
        cx,
        cy,
        corners: best.corners,
      },
    };
  } catch {
    return { detected: false, metresPerPixel: null };
  }
}

/**
 * Draws ArUco marker overlay on a canvas 2D context.
 * Call this after drawing the video frame.
 */
export function drawArucoOverlay(
  ctx: CanvasRenderingContext2D,
  detection: ArucoDetection,
  markerSizeM = 0.10,
): void {
  const { corners, cx, cy, sidePx, id } = detection;
  const mpp = markerSizeM / sidePx;

  // Marker border
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.strokeStyle = "#00FF88";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Corner dots
  corners.forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = ["#FF4444", "#44FF44", "#4444FF", "#FFFF44"][i] ?? "#FFFFFF";
    ctx.fill();
  });

  // Centre label — ID + scale
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(cx - 52, cy - 16, 104, 28);
  ctx.fillStyle = "#00FF88";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`ID:${id}  1px = ${(mpp * 100).toFixed(2)} cm`, cx, cy);
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/** Average side length from 4 ordered corners */
function avgSide(corners: Array<{ x: number; y: number }>): number {
  if (!corners || corners.length < 4) return 0;
  let total = 0;
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    total += Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }
  return total / 4;
}

/**
 * Returns ImageData from a playing HTMLVideoElement.
 * Used to feed a single frame into detectArucoScale().
 */
export function videoFrameToImageData(video: HTMLVideoElement): ImageData | null {
  try {
    const w = video.videoWidth  || video.clientWidth;
    const h = video.videoHeight || video.clientHeight;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  } catch { return null; }
}
