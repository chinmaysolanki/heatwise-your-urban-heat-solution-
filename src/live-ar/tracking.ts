import type { TrackingQuality, WorldPoint3D, LiveARSessionState } from "./types";

// Abstraction over WebXR/ARCore/ARKit — implementation can be swapped.

export interface LiveARTrackingAdapter {
  startSession(): Promise<void>;
  endSession(): Promise<void>;
  onFrame(cb: (quality: TrackingQuality) => void): () => void;
  onTap(cb: (worldPoint: WorldPoint3D) => void): () => void;
}

export function createNoopTrackingAdapter(): LiveARTrackingAdapter {
  return {
    async startSession() {},
    async endSession() {},
    onFrame() {
      return () => {};
    },
    onTap() {
      return () => {};
    },
  };
}

export function initialSessionState(): LiveARSessionState {
  return {
    active: false,
    trackingQuality: "none",
    points: [],
    edges: [],
    polygon: null,
    resultPreview: null,
  };
}

