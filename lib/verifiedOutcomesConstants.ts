/**
 * Canonical mismatch + workflow strings (align with ml/verified_outcomes/schemas).
 */

export const MISMATCH_REASON_CODES = [
  "budget_too_high",
  "species_unavailable",
  "installer_not_confident",
  "structural_constraint_found",
  "waterproofing_issue_found",
  "irrigation_not_feasible",
  "user_changed_preference",
  "space_measurement_changed",
  "local_availability_issue",
  "maintenance_concern",
  "safety_concern",
  "weather_or_seasonality_issue",
  "compliance_or_building_rule_issue",
  "installer_better_alternative",
  "partial_install_only",
] as const;

export type MismatchReasonCode = (typeof MISMATCH_REASON_CODES)[number];

export const MISMATCH_REASON_SET = new Set<string>(MISMATCH_REASON_CODES);

export const JOB_STATUSES = ["scheduled", "in_progress", "completed", "cancelled", "on_hold"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const QUOTE_REQUEST_STATUSES = [
  "draft",
  "submitted",
  "assigned",
  "quoting",
  "quote_received",
  "accepted",
  "cancelled",
] as const;

export const QUOTE_STATUSES = ["submitted", "accepted", "rejected", "superseded", "expired"] as const;

export const ASSIGNMENT_STATUSES = ["invited", "viewed", "declined", "quoted"] as const;
