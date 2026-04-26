/**
 * Phase 0–1: HTTP-level DTOs for layout + ML orchestration.
 * Used by POST /api/generate-layout and optional attachment on POST /api/recommendations/generate.
 */

import type { ProjectInput, Recommendation } from "@/models";
import type { TelemetryMeta } from "@/lib/ml/recommendationRuntimeTypes";

/** Body shape for POST /api/generate-layout (backward compatible). */
export type GenerateLayoutHttpRequest = ProjectInput & {
  projectId?: string | null;
  photoSessionId?: string | null;
};

/** JSON body returned by POST /api/generate-layout (backward compatible). */
export type GenerateLayoutHttpResponse = {
  recommendations: Recommendation[];
  durationMs: number;
  totalCandidates: number;
  mlTelemetryMeta: TelemetryMeta | null;
  mlMode: "full_ml" | "rules_only" | "partial_ml" | null;
};
