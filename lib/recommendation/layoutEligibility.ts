import type { ProjectInput } from "@/models";
import type { RecommendationGenerateRequest } from "@/lib/ml/recommendationRuntimeTypes";
import { recommendationRequestToProjectInput } from "@/lib/recommendation/recommendationRequestToProjectInput";

export type LayoutIneligibleReason =
  | "MISSING_SPACE_TYPE"
  | "UNSUPPORTED_SPACE_TYPE"
  | "MISSING_FLOOR_DIMENSIONS"
  | "LAYOUT_INPUT_INCOMPLETE";

export type LayoutEligibilityResult = {
  eligible: boolean;
  projectInput: ProjectInput | null;
  ineligibleReason?: LayoutIneligibleReason;
};

/**
 * Single gate for whether POST /api/recommendations/generate must attach a layout slate.
 * Matches `recommendationRequestToProjectInput` plus explicit reasons for diagnostics.
 */
export function getLayoutEligibility(body: RecommendationGenerateRequest): LayoutEligibilityResult {
  const projectInput = recommendationRequestToProjectInput(body);
  if (projectInput) {
    return { eligible: true, projectInput };
  }

  const p = body.project ?? {};
  const rawSpace = String(p.space_kind ?? p.spaceType ?? p.project_type ?? "").toLowerCase().trim();
  if (!rawSpace) {
    return { eligible: false, projectInput: null, ineligibleReason: "MISSING_SPACE_TYPE" };
  }
  if (rawSpace !== "rooftop" && rawSpace !== "terrace" && rawSpace !== "balcony") {
    return { eligible: false, projectInput: null, ineligibleReason: "UNSUPPORTED_SPACE_TYPE" };
  }
  const widthM = Number(p.width_m ?? p.widthM);
  const lengthM = Number(p.length_m ?? p.lengthM);
  if (!Number.isFinite(widthM) || !Number.isFinite(lengthM)) {
    return { eligible: false, projectInput: null, ineligibleReason: "MISSING_FLOOR_DIMENSIONS" };
  }

  return { eligible: false, projectInput: null, ineligibleReason: "LAYOUT_INPUT_INCOMPLETE" };
}
