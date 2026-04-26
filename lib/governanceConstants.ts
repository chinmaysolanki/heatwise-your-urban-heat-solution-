/** Consent scopes for user-facing sensitive workflows. */
export const CONSENT_SCOPES = [
  "project_media",
  "recommendation_telemetry",
  "installer_sharing",
  "followup_outreach",
  "analytics_usage",
] as const;
export type ConsentScope = (typeof CONSENT_SCOPES)[number];

export const CONSENT_STATUSES = ["granted", "denied", "withdrawn", "pending"] as const;

export const GOVERNANCE_FLAG_TYPES = [
  "risky_record",
  "missing_evidence",
  "low_confidence_output",
  "pricing_anomaly",
  "installer_mismatch",
  "governance_review_needed",
] as const;

export const GOVERNANCE_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const GOVERNANCE_FLAG_STATUSES = ["open", "acknowledged", "resolved", "waived"] as const;

export const RETENTION_ENTITY_CATEGORIES = [
  "user_profile",
  "project_media",
  "recommendation_telemetry",
  "installer_commercial",
  "verified_outcomes",
  "integration_events",
  "platform_audit",
  "governance_records",
] as const;

export const GOVERNANCE_REVIEW_TYPES = [
  "high_risk_dossier",
  "pricing_dispute",
  "data_subject_request",
  "anomaly_escalation",
  "policy_exception",
] as const;

export const GOVERNANCE_REVIEW_STATUSES = ["queued", "in_review", "approved", "rejected", "escalated"] as const;
export const GOVERNANCE_REVIEW_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
