/** Monetization / ledger event types (append-only revenue log). */
export const REVENUE_EVENT_TYPES = [
  "quote_fee_charged",
  "subscription_started",
  "subscription_renewed",
  "subscription_cancelled",
  "installer_lead_fee",
  "installer_commission_earned",
  "installer_commission_refunded",
  "consultation_fee",
  "design_fee",
  "install_conversion_revenue",
  "maintenance_plan_started",
  "maintenance_plan_renewed",
  "maintenance_plan_cancelled",
  "refund_issued",
] as const;

export type RevenueEventType = (typeof REVENUE_EVENT_TYPES)[number];

export const REVENUE_STATUSES = [
  "recorded",
  "pending_settlement",
  "settled",
  "void",
  "disputed",
  "reversed",
] as const;

export type RevenueStatus = (typeof REVENUE_STATUSES)[number];

/** Funnel milestones (ordering for sequence validation). */
export const FUNNEL_STAGES = [
  "project_created",
  "recommendation_generated",
  "recommendation_saved",
  "installer_requested",
  "quote_requested",
  "quote_received",
  "quote_accepted",
  "site_visit_scheduled",
  "install_started",
  "install_completed",
  "followup_completed",
  "maintenance_plan_started",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

/** Stage order index (inclusive); used for impossible-sequence checks. */
export const FUNNEL_STAGE_ORDER: Record<string, number> = Object.fromEntries(
  FUNNEL_STAGES.map((s, i) => [s, i]),
) as Record<string, number>;

export const COMMERCIAL_STATUSES = [
  "exploring",
  "quoted",
  "accepted",
  "installed",
  "churned",
  "refunded",
  "unknown",
] as const;
