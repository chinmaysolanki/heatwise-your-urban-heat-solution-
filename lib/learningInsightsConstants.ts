export const INSIGHT_TYPES = ["window_summary", "quality_kpi", "experiment_health"] as const;

export const LESSON_POLARITIES = ["works", "fails", "mixed"] as const;

export const LESSON_CONFIDENCE = ["low", "medium", "high"] as const;

/** Normalized segment dimensions (unknown = coarse bucket). */
export const SEGMENT_DIMENSION_KEYS = [
  "project_type",
  "climate_zone",
  "budget_band",
  "region",
  "user_type",
  "installer_availability_band",
  "personalization_confidence_band",
] as const;
