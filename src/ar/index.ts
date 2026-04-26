// ============================================================
// HeatWise — AR Integration Public API
// src/ar/index.ts
// ============================================================

import type { Recommendation, ARSpatialMapping } from "@/models";
import { mapLayoutToSpatialAnchors } from "@/recommendation-engine";

// Hook (for custom integrations)
export { useARMeasurement } from "../hooks/useARMeasurement";

// Components
export { AROverlay }         from "../components/AROverlay/AROverlay";
export { ManualMeasurement } from "../components/ManualMeasurement/ManualMeasurement";

// Services (for testing / direct use)
export {
  checkCapabilities,
  requestCameraPermission,
  openCamera,
  computeTiltAngle,
  estimateCameraHeight,
} from "../services/arCameraService";

// Math utils (exposed for testing)
export {
  computeRealWorldDimensions,
  estimateConfidence,
  estimateCameraFOV,
} from "../utils/perspectiveMath";

// Derived spatial mapping for AR
export function createSpatialMappingFromRecommendation(
  rec: Recommendation,
): ARSpatialMapping {
  // Same layout anchor convention as the shared layout pipeline (`/api/recommendations/generate` → layoutGeneration).
  return mapLayoutToSpatialAnchors(rec.layoutSchema, "top_left");
}

// Types
export type {
  ARMeasurementResult,
  ARSession,
  ARSessionState,
  CornerSet,
  CornerID,
  ScreenPoint,
  CalibrationData,
  CameraCapabilities,
} from "../types/ar.types";
