import { MISMATCH_REASON_SET } from "@/lib/verifiedOutcomesConstants";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

const JOB_NEXT: Record<string, Set<string>> = {
  scheduled: new Set(["in_progress", "cancelled", "on_hold"]),
  on_hold: new Set(["scheduled", "cancelled", "in_progress"]),
  in_progress: new Set(["completed", "cancelled", "on_hold"]),
  completed: new Set(),
  cancelled: new Set(),
};

export function assertMismatchReasonCodes(codes: unknown): string[] | StructuredError {
  if (!Array.isArray(codes)) return validationError("INVALID_MISMATCH", "reasonCodes must be an array");
  for (const c of codes) {
    if (typeof c !== "string" || !MISMATCH_REASON_SET.has(c)) {
      return validationError("INVALID_MISMATCH_CODE", `Unknown code: ${c}`);
    }
  }
  return codes as string[];
}

export function assertMatchVsMismatch(
  matches: boolean,
  codes: string[],
): StructuredError | null {
  if (matches && codes.length > 0) {
    return validationError("MATCH_MISMATCH_CONFLICT", "matches_recommended_candidate true with mismatch codes");
  }
  if (!matches && codes.length === 0) {
    return validationError("MISMATCH_REQUIRED", "mismatch reason codes required when not matching recommendation");
  }
  return null;
}

export function canTransitionJob(from: string, to: string): boolean {
  return JOB_NEXT[from]?.has(to) ?? false;
}
