// ============================================================
// HeatWise — Recommendation Engine
// recommendation-engine/index.ts
// ============================================================

export { runPipeline, runBudgetFirstPipeline, runCoolingFirstPipeline } from "./pipeline";
export type { PipelineOptions } from "./pipeline";
export type {
  ProjectInput,
  PipelineResult,
  Recommendation,
  ARSpatialMapping,
  HeatReductionSummary,
  RecommendationFeedbackEvent,
} from "@/models";

export { mapLayoutToSpatialAnchors } from "./layoutSpatialMapper";
export { buildHeatReductionSummary } from "./heatReductionEstimator";
export {
  recordFeedback,
  getFeedbackSnapshot,
  clearFeedback,
} from "./recommendationFeedbackService";
