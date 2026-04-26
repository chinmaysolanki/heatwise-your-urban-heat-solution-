// ============================================================
// HeatWise — AR Measurement Types
// src/types/ar.types.ts
// ============================================================

import type React from "react";

// ─── Coordinate Types ────────────────────────────────────────

/** A 2D point on the device screen in pixels */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** A 3D point in real-world space in metres */
export interface WorldPoint {
  x: number;
  y: number;
  z: number;
}

/** A corner marker placed by the user on the AR overlay */
export interface CornerMarker {
  id:          CornerID;
  screen:      ScreenPoint;
  isPlaced:    boolean;
  label:       string;   // "Top-Left", "Top-Right" etc.
}

export type CornerID = "tl" | "tr" | "br" | "bl";

/** Ordered corner set — all four must be placed before measurement */
export type CornerSet = Record<CornerID, CornerMarker>;

// ─── Measurement Result ──────────────────────────────────────

export interface ARMeasurementResult {
  widthM:        number;
  lengthM:       number;
  areaSqM:       number;
  confidence:    MeasurementConfidence;
  method:        MeasurementMethod;
  rawCorners:    CornerSet;
  calibration:   CalibrationData;
  capturedAt:    string;  // ISO timestamp
}

export type MeasurementConfidence = "low" | "medium" | "high";
export type MeasurementMethod     = "ar_corners" | "ar_edge" | "manual";

// ─── Calibration ─────────────────────────────────────────────

/** Data used to convert pixel distances to real-world metres */
export interface CalibrationData {
  /** Camera field of view in degrees (horizontal) */
  hFovDeg:           number;
  /** Estimated camera height above the surface in metres */
  cameraHeightM:     number;
  /** Device tilt angle from horizontal (degrees) */
  tiltAngleDeg:      number;
  /** Pixels per metre at the estimated shooting distance */
  pixelsPerMetre:    number;
  /** Whether device orientation sensor was available */
  hasSensorData:     boolean;
}

// ─── AR Session State ────────────────────────────────────────

export type ARSessionState =
  | "idle"
  | "requesting_permission"
  | "permission_denied"
  | "initialising"
  | "calibrating"
  | "placing_corners"
  | "confirming"
  | "processing"
  | "complete"
  | "error";

export interface ARSession {
  state:           ARSessionState;
  corners:         CornerSet;
  placedCount:     number;          // 0–4
  activeCorner:    CornerID | null; // which corner the user is placing next
  deviceTilt:      number;          // degrees from horizontal (0 = flat)
  cameraHeightM:   number;          // estimated from floor level
  result:          ARMeasurementResult | null;
  error:           string | null;
  canvasRef:       React.RefObject<HTMLCanvasElement> | null;
  videoRef:        React.RefObject<HTMLVideoElement>  | null;
}

// ─── Device Orientation ──────────────────────────────────────

export interface DeviceOrientation {
  alpha: number | null;  // rotation around z-axis (0–360)
  beta:  number | null;  // front-to-back tilt (-180 to 180)
  gamma: number | null;  // left-to-right tilt (-90 to 90)
}

// ─── Camera Capabilities ─────────────────────────────────────

export interface CameraCapabilities {
  hasCamera:          boolean;
  hasOrientationAPI:  boolean;
  hasMotionAPI:       boolean;
  isSecureContext:    boolean;
  supportedFacingModes: string[];
}

// ─── Perspective Math ─────────────────────────────────────────

/** A 3×3 homography matrix (row-major) */
export type Homography = [
  number, number, number,
  number, number, number,
  number, number, number,
];

export interface PerspectiveResult {
  widthM:      number;
  lengthM:     number;
  skewDeg:     number;  // how far from a rectangle (0 = perfect)
  valid:       boolean;
  reason?:     string;  // if invalid
}

export interface CameraStream {
  stream:      MediaStream;
  track:       MediaStreamTrack;
  hFovDeg:     number;
  widthPx:     number;
  heightPx:    number;
  stop:        () => void;
}
