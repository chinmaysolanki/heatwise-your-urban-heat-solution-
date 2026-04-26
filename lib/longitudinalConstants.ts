/** Align with ``ml/longitudinal_tracking/schemas`` and Python validators. */

export const FOLLOWUP_ALLOWED_OFFSETS = [7, 30, 90, 180] as const;

export const FOLLOWUP_EVENT_TYPES = [
  "completion",
  "missed",
  "rescheduled",
  "unreachable",
  "qualitative_note",
  "skipped",
] as const;

export type FollowupEventType = (typeof FOLLOWUP_EVENT_TYPES)[number];

export const CHECKPOINT_STATUSES = [
  "pending",
  "completed",
  "missed",
  "rescheduled",
  "unreachable",
  "skipped",
] as const;
