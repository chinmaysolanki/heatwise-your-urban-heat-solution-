/**
 * Canonical enums for ML telemetry (API + DB + Python validators should stay aligned).
 */

export const GENERATOR_SOURCES = [
  "synthetic_bootstrap",
  "live_rules",
  "ml_ranker",
  "hybrid",
  /** Node catalog + species_features hybrid when Python serving is unavailable */
  "catalog_hybrid_ts",
] as const;
export type GeneratorSource = (typeof GENERATOR_SOURCES)[number];

export const FEEDBACK_EVENT_TYPES = [
  "recommendation_impression",
  "recommendation_view",
  "recommendation_expand",
  "recommendation_compare",
  "recommendation_save",
  "recommendation_unsave",
  "recommendation_share",
  "recommendation_dismiss",
  "recommendation_select",
  "recommendation_request_regenerate",
  "recommendation_request_ar_preview",
  "recommendation_request_before_after",
  "recommendation_request_installer",
  "recommendation_feedback_positive",
  "recommendation_feedback_negative",
  /** Phase 6 canonical learning events (preferred for new writes) */
  "recommendation_run_viewed",
  "candidate_viewed",
  "candidate_selected",
  "candidate_dismissed",
  "candidate_rated_positive",
  "candidate_rated_negative",
  "visualization_requested",
  "report_opened",
  "installer_export_requested",
  "installation_request_started",
] as const;
export type FeedbackEventType = (typeof FEEDBACK_EVENT_TYPES)[number];

export const INSTALL_STATUSES = [
  "planned",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
  "on_hold",
] as const;
export type InstallStatus = (typeof INSTALL_STATUSES)[number];

export const EVENT_SOURCES = ["mobile_app", "web_app", "installer_portal", "api", "system"] as const;
