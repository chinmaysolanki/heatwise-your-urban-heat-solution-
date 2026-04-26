import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import { FOLLOWUP_ALLOWED_OFFSETS } from "@/lib/longitudinalConstants";

const MS_DAY = 86_400_000;

function normalizeOffsets(raw: unknown): number[] | StructuredError {
  const def = [...FOLLOWUP_ALLOWED_OFFSETS];
  if (raw === undefined || raw === null) return def;
  if (!Array.isArray(raw)) return validationError("INVALID_OFFSETS", "offsetsDays must be an array");
  const nums = raw.map((x) => Number(x));
  if (nums.some((n) => !Number.isInteger(n) || n <= 0)) {
    return validationError("INVALID_OFFSETS", "offsets must be positive integers");
  }
  const allowed = new Set(FOLLOWUP_ALLOWED_OFFSETS);
  for (const n of nums) {
    if (!allowed.has(n as (typeof FOLLOWUP_ALLOWED_OFFSETS)[number])) {
      return validationError("INVALID_OFFSETS", `offset ${n} not in allowed set`, { allowed: [...allowed] });
    }
  }
  if (new Set(nums).size !== nums.length) {
    return validationError("INVALID_OFFSETS", "offsets must be unique");
  }
  return nums;
}

export type CreateFollowupScheduleInput = {
  projectId: string;
  userId: string | null;
  baselineAt: string | Date;
  verifiedInstallId?: string | null;
  offsetsDays?: number[];
};

export async function createFollowupSchedule(
  input: CreateFollowupScheduleInput,
): Promise<{ ok: true; scheduleId: string } | { ok: false; error: StructuredError }> {
  const offsets = normalizeOffsets(input.offsetsDays);
  if ("code" in offsets) return { ok: false, error: offsets };

  const baseline = new Date(input.baselineAt);
  if (Number.isNaN(baseline.getTime())) {
    return { ok: false, error: validationError("INVALID_DATE", "baselineAt invalid") };
  }

  if (input.verifiedInstallId) {
    const vi = await db.verifiedInstallRecord.findUnique({
      where: { id: input.verifiedInstallId },
      select: { projectId: true },
    });
    if (!vi || vi.projectId !== input.projectId) {
      return { ok: false, error: validationError("VERIFIED_INSTALL_MISMATCH", "verified install not on project") };
    }
  }

  const schedule = await db.longitudinalFollowupSchedule.create({
    data: {
      projectId: input.projectId,
      userId: input.userId,
      verifiedInstallId: input.verifiedInstallId ?? null,
      baselineAt: baseline,
      offsetsIncludedJson: JSON.stringify(offsets),
      scheduleStatus: "active",
    },
  });

  await db.$transaction(
    offsets.map((d) =>
      db.longitudinalFollowupCheckpoint.create({
        data: {
          scheduleId: schedule.id,
          offsetDays: d,
          windowLabel: `${d}d`,
          dueAt: new Date(baseline.getTime() + d * MS_DAY),
          checkpointStatus: "pending",
        },
      }),
    ),
  );

  return { ok: true, scheduleId: schedule.id };
}
