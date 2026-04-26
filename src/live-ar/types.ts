import type { Confidence } from "@/models";

export type TrackingQuality = "none" | "limited" | "good" | "excellent";

export interface WorldPoint3D {
  id: string;
  label?: string;
  x: number; // meters in world space
  y: number;
  z: number;
}

export interface MeasurementEdge {
  id: string;
  fromPointId: string;
  toPointId: string;
  lengthM: number;
}

export interface MeasurementPolygon {
  id: string;
  pointIds: string[];      // ordered ring
  areaSqM: number;
  perimeterM: number;
  selfIntersecting: boolean;
}

export interface LiveARMeasurementResult {
  id: string;
  createdAt: string;       // ISO
  updatedAt: string;       // ISO

  points: WorldPoint3D[];
  edges: MeasurementEdge[];
  polygon: MeasurementPolygon | null;

  widthM?: number | null;   // fallback width / bounding box
  lengthM?: number | null;  // fallback length / bounding box

  trackingQuality: TrackingQuality;
  confidence: Confidence;
  confidenceScore: number;   // 0–1 numeric score

  // raw AR session metadata (opaque)
  arSessionMeta?: Record<string, unknown>;
}

export interface LiveARSessionState {
  active: boolean;
  trackingQuality: TrackingQuality;
  points: WorldPoint3D[];
  edges: MeasurementEdge[];
  polygon: MeasurementPolygon | null;
  resultPreview: LiveARMeasurementResult | null;
}

