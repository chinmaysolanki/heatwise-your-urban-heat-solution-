// ============================================================
// HeatWise — AR Camera Service
// src/services/arCameraService.ts
//
// Handles all camera and sensor I/O.
// Pure service — no React, no state.
// Returns data; callers decide what to do with it.
// ============================================================

import type { CameraCapabilities, DeviceOrientation } from "../types/ar.types";
import { estimateCameraFOV } from "../utils/perspectiveMath";

// ─── Camera Permission & Capabilities ────────────────────────

/**
 * Checks what AR capabilities this device/browser supports.
 * Call this before attempting to open the camera.
 */
export async function checkCapabilities(): Promise<CameraCapabilities> {
  const hasCamera = !!(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );

  const hasOrientationAPI = typeof DeviceOrientationEvent !== "undefined";
  const hasMotionAPI      = typeof DeviceMotionEvent !== "undefined";
  const isSecureContext   = window.isSecureContext;

  let supportedFacingModes: string[] = [];
  if (hasCamera) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === "videoinput");
      supportedFacingModes = videoDevices.length > 1
        ? ["environment", "user"]
        : ["environment"];
    } catch {
      supportedFacingModes = ["environment"];
    }
  }

  return {
    hasCamera,
    hasOrientationAPI,
    hasMotionAPI,
    isSecureContext,
    supportedFacingModes,
  };
}

/**
 * Requests camera permission explicitly.
 * Returns the permission state without starting a stream.
 */
export async function requestCameraPermission(): Promise<
  "granted" | "denied" | "error"
> {
  try {
    // Try the Permissions API first (Chrome/Android)
    if (navigator.permissions) {
      const result = await navigator.permissions.query({
        name: "camera" as PermissionName,
      });
      if (result.state === "denied") return "denied";
    }

    // Attempt a quick stream to trigger the browser prompt
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    // Immediately stop — we just wanted the permission prompt
    stream.getTracks().forEach(t => t.stop());
    return "granted";
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === "NotAllowedError") return "denied";
    }
    return "error";
  }
}

// ─── Camera Stream ────────────────────────────────────────────

export interface CameraStream {
  stream:      MediaStream;
  track:       MediaStreamTrack;
  hFovDeg:     number;    // estimated horizontal FOV
  widthPx:     number;
  heightPx:    number;
  stop:        () => void;
}

/**
 * Opens the rear camera with the highest available resolution.
 * Returns a CameraStream object that must be attached to a
 * <video> element by the caller.
 */
export async function openCamera(): Promise<CameraStream> {
  const constraints: MediaStreamConstraints = {
    video: {
      facingMode:  { ideal: "environment" },  // rear camera
      width:       { ideal: 1920 },
      height:      { ideal: 1080 },
      aspectRatio: { ideal: 16 / 9 },
    },
    audio: false,
  };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch {
    // Fallback — try without resolution hints
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
  }

  const track    = stream.getVideoTracks()[0];
  const settings = track?.getSettings() ?? {};
  const hFovDeg  = estimateCameraFOV(track ?? null);

  return {
    stream,
    track:   track!,
    hFovDeg,
    widthPx:  settings.width  ?? 1280,
    heightPx: settings.height ?? 720,
    stop: () => stream.getTracks().forEach(t => t.stop()),
  };
}

/**
 * Attaches a MediaStream to a <video> element and waits
 * for the video to start playing.
 */
export async function attachStreamToVideo(
  video:  HTMLVideoElement,
  stream: MediaStream,
): Promise<void> {
  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  video.setAttribute("autoplay",    "true");
  video.muted = true;

  return new Promise((resolve, reject) => {
    video.onloadedmetadata = () => {
      video.play().then(resolve).catch(reject);
    };
    video.onerror = () => reject(new Error("Video element error"));
    // Timeout after 5s
    setTimeout(() => reject(new Error("Camera stream timed out")), 5000);
  });
}

/**
 * Captures a still frame from a video element as an ImageData.
 * Used for edge detection or confirmation thumbnail.
 */
export function captureFrame(
  video:  HTMLVideoElement,
  canvas: HTMLCanvasElement,
): ImageData | null {
  if (video.videoWidth === 0) return null;

  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// ─── Device Orientation ───────────────────────────────────────

export interface OrientationSubscription {
  unsubscribe: () => void;
}

/**
 * Subscribes to device orientation events.
 * On iOS 13+, requires a user gesture to request permission first.
 * Returns an unsubscribe function.
 */
export async function subscribeToOrientation(
  onUpdate: (orientation: DeviceOrientation) => void,
): Promise<OrientationSubscription> {
  // iOS 13+ requires explicit permission
  if (
    typeof (DeviceOrientationEvent as any).requestPermission === "function"
  ) {
    try {
      const perm = await (DeviceOrientationEvent as any).requestPermission();
      if (perm !== "granted") {
        return { unsubscribe: () => {} };
      }
    } catch {
      return { unsubscribe: () => {} };
    }
  }

  const handler = (e: globalThis.DeviceOrientationEvent) => {
    onUpdate({ alpha: e.alpha, beta: e.beta, gamma: e.gamma });
  };

  window.addEventListener("deviceorientation", handler, true);
  return {
    unsubscribe: () =>
      window.removeEventListener("deviceorientation", handler, true),
  };
}

/**
 * Estimates camera tilt from device orientation.
 * When a user holds a phone to photograph their floor:
 *   - beta ≈ 0   → phone flat (looking straight down)
 *   - beta ≈ 90  → phone vertical (portrait, looking ahead)
 *
 * Returns the angle from horizontal in degrees (0 = flat, 90 = vertical).
 */
export function computeTiltAngle(orientation: DeviceOrientation): number {
  const beta = orientation.beta ?? 45; // default to 45° if no sensor
  // Clamp to 0–85° to avoid division-by-zero at full vertical
  return Math.max(0, Math.min(85, Math.abs(beta)));
}

/**
 * Estimates the camera height above the floor based on:
 *   - floorLevel: the floor the space is on (for context)
 *   - Returns a practical shooting height in metres
 *
 * A user photographing a rooftop typically holds their phone
 * at waist/chest height: ~1.0–1.4m above the surface.
 */
export function estimateCameraHeight(tiltAngleDeg: number): number {
  // If phone is nearly flat (tilt < 20°) user is likely
  // holding it above the floor looking straight down → ~1.2m
  if (tiltAngleDeg < 20) return 1.2;
  // If angled (~30–60°) they're photographing from standing → ~1.5m
  if (tiltAngleDeg < 60) return 1.5;
  // If nearly vertical they're probably taking a wide shot → ~1.7m
  return 1.7;
}
