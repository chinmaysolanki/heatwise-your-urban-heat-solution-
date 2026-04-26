/** Known integration actors (extend without vendor lock-in). */
export const KNOWN_SYSTEMS = [
  "heatwise_core",
  "generic_rest_partner",
  "generic_webhook_source",
  "crm_sink",
  "installer_partner_api",
  "notification_provider",
  "payment_provider",
  "analytics_sink",
  "report_delivery",
  "user_device",
] as const;

export type KnownSystem = (typeof KNOWN_SYSTEMS)[number];

export const INTEGRATION_DOMAINS = [
  "crm",
  "installer_partner",
  "notification",
  "payment",
  "analytics_sink",
  "report_delivery",
  "internal",
] as const;

export const SYNC_STATUSES = ["pending", "in_progress", "succeeded", "failed", "dead_letter"] as const;

export const DELIVERY_STATUSES = ["queued", "sending", "delivered", "bounced", "failed", "cancelled"] as const;

export const WEBHOOK_VALIDATION_STATUSES = ["received", "valid", "invalid", "rejected", "duplicate"] as const;
