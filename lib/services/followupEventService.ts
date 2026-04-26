import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import type { FollowupEventType } from "@/lib/longitudinalConstants";
import { FOLLOWUP_EVENT_TYPES } from "@/lib/longitudinalConstants";

const NEXT_STATUS: Partial<Record<FollowupEventType, string>> = {
  completion: "completed",
  missed: "missed",
  rescheduled: "rescheduled",
  unreachable: "unreachable",
  skipped: "skipped",
};

function isEventType(x: string): x is FollowupEventType {
  return (FOLLOWUP_EVENT_TYPES as readonly string[]).includes(x);
}

export type LogFollowupEventInput = {
  checkpointId: string;
  eventType: string;
  qualitativeNote?: string | null;
  metadata?: Record<string, unknown> | null;
  eventAt?: string | Date | null;
};

export async function logFollowupEvent(
  input: LogFollowupEventInput,
): Promise<{ ok: true; eventId: string } | { ok: false; error: StructuredError }> {
  if (!isEventType(input.eventType)) {
    return { ok: false, error: validationError("INVALID_EVENT_TYPE", "unknown follow-up event type") };
  }

  const cp = await db.longitudinalFollowupCheckpoint.findUnique({ where: { id: input.checkpointId } });
  if (!cp) return { ok: false, error: validationError("NOT_FOUND", "checkpoint not found") };

  const eventAt = input.eventAt ? new Date(input.eventAt) : new Date();
  if (Number.isNaN(eventAt.getTime())) {
    return { ok: false, error: validationError("INVALID_DATE", "eventAt invalid") };
  }

  let newDue: Date | null = null;
  if (input.eventType === "rescheduled") {
    const raw = input.metadata?.newDueAt ?? input.metadata?.new_due_at;
    if (!raw) {
      return { ok: false, error: validationError("METADATA_REQUIRED", "rescheduled requires metadata.newDueAt") };
    }
    newDue = new Date(String(raw));
    if (Number.isNaN(newDue.getTime())) {
      return { ok: false, error: validationError("INVALID_DATE", "newDueAt invalid") };
    }
  }

  const event = await db.longitudinalFollowupEvent.create({
    data: {
      checkpointId: input.checkpointId,
      eventType: input.eventType,
      eventAt,
      qualitativeNote: input.qualitativeNote ?? null,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });

  const statusUpdate = NEXT_STATUS[input.eventType];
  if (statusUpdate) {
    const data: Record<string, unknown> = {
      checkpointStatus: statusUpdate,
      lastNote: input.qualitativeNote ?? cp.lastNote,
    };
    if (input.eventType === "completion") {
      data.completedAt = eventAt;
    }
    if (input.eventType === "rescheduled" && newDue) {
      data.rescheduledDueAt = newDue;
      data.dueAt = newDue;
      data.checkpointStatus = "pending";
    }
    await db.longitudinalFollowupCheckpoint.update({
      where: { id: input.checkpointId },
      data: data as any,
    });
  } else if (input.eventType === "qualitative_note") {
    await db.longitudinalFollowupCheckpoint.update({
      where: { id: input.checkpointId },
      data: { lastNote: input.qualitativeNote ?? cp.lastNote },
    });
  }

  return { ok: true, eventId: event.id };
}
