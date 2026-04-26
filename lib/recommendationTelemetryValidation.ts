import {
  FEEDBACK_EVENT_TYPES,
  GENERATOR_SOURCES,
  INSTALL_STATUSES,
} from "./recommendationTelemetryConstants";
import type { StructuredError } from "./recommendationTelemetryTypes";

const MAX_INR = 5_000_000_000;
const MAX_TEMP_DELTA = 25;
const SCORE_MIN = 0;
const SCORE_MAX = 1;

export function validationError(
  code: string,
  message: string,
  details?: unknown,
): StructuredError {
  return { code, message, details };
}

export function isStructuredError(x: unknown): x is StructuredError {
  return typeof x === "object" && x !== null && "code" in x && "message" in x;
}

export function assertNonEmptyString(v: unknown, field: string): string | StructuredError {
  if (v === undefined || v === null || String(v).trim() === "") {
    return validationError("REQUIRED_FIELD", `Missing ${field}`);
  }
  return String(v);
}

export function assertOptionalScore(
  v: unknown,
  field: string,
): number | null | undefined | StructuredError {
  if (v === undefined || v === null) return v as null | undefined;
  const n = Number(v);
  if (Number.isNaN(n) || n < SCORE_MIN || n > SCORE_MAX) {
    return validationError("INVALID_RANGE", `${field} must be in [0,1]`, { value: v });
  }
  return n;
}

export function assertInr(
  v: unknown,
  field: string,
): number | null | undefined | StructuredError {
  if (v === undefined || v === null) return v as null | undefined;
  const n = Number(v);
  if (Number.isNaN(n) || n < 0 || n > MAX_INR) {
    return validationError("INVALID_INR", `${field} out of sane range`, { value: v });
  }
  return n;
}

export function assertGeneratorSource(v: unknown): string | StructuredError {
  const s = assertNonEmptyString(v, "generatorSource");
  if (typeof s !== "string") return s;
  if (!GENERATOR_SOURCES.includes(s as (typeof GENERATOR_SOURCES)[number])) {
    return validationError("INVALID_ENUM", "generatorSource not allowed", { allowed: GENERATOR_SOURCES });
  }
  return s;
}

export function assertEventType(v: unknown): string | StructuredError {
  const s = assertNonEmptyString(v, "eventType");
  if (typeof s !== "string") return s;
  if (!FEEDBACK_EVENT_TYPES.includes(s as (typeof FEEDBACK_EVENT_TYPES)[number])) {
    return validationError("INVALID_ENUM", "eventType not allowed", { allowed: FEEDBACK_EVENT_TYPES });
  }
  return s;
}

export function assertInstallStatus(v: unknown): string | StructuredError {
  const s = assertNonEmptyString(v, "installStatus");
  if (typeof s !== "string") return s;
  if (!INSTALL_STATUSES.includes(s as (typeof INSTALL_STATUSES)[number])) {
    return validationError("INVALID_ENUM", "installStatus not allowed", { allowed: INSTALL_STATUSES });
  }
  return s;
}

export function assertTempDelta(
  v: unknown,
  field: string,
): number | null | undefined | StructuredError {
  if (v === undefined || v === null) return v as null | undefined;
  const n = Number(v);
  if (Number.isNaN(n) || Math.abs(n) > MAX_TEMP_DELTA) {
    return validationError("INVALID_TEMP", `${field} exceeds plausible magnitude`, { maxAbs: MAX_TEMP_DELTA });
  }
  return n;
}

/** Selection events should reference a candidate snapshot when possible */
export function warnSelectWithoutCandidate(eventType: string, candidateSnapshotId: unknown): StructuredError | null {
  const isSelect = eventType === "recommendation_select" || eventType === "candidate_selected";
  if (isSelect && (candidateSnapshotId === undefined || candidateSnapshotId === null)) {
    return validationError(
      "MISSING_CANDIDATE_REF",
      "selection events should include candidateSnapshotId for training-quality rows",
    );
  }
  return null;
}

/** completed installs require installDate */
export function assertInstallOutcomeRules(
  installStatus: string,
  installDate: unknown,
): StructuredError | null {
  if (installStatus === "completed" && (installDate === undefined || installDate === null || installDate === "")) {
    return validationError("INVALID_COMBO", "install_status completed requires install_date");
  }
  return null;
}
