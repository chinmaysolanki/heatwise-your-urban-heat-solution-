import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import {
  ERROR_SEVERITIES,
  KNOWN_ERROR_CODES,
  PLATFORM_SUBSYSTEMS,
} from "@/lib/platformHardeningConstants";
import type { StructuredErrorContract } from "@/lib/platformHardeningTypes";

const CODE_RE = /^[A-Z][A-Z0-9_]{0,63}$/;

function isSeverity(x: unknown): boolean {
  return typeof x === "string" && (ERROR_SEVERITIES as readonly string[]).includes(x);
}

function isSubsystem(x: unknown): boolean {
  if (x == null || x === "") return true;
  return typeof x === "string" && (PLATFORM_SUBSYSTEMS as readonly string[]).includes(x);
}

function isKnownCode(x: string): boolean {
  return (KNOWN_ERROR_CODES as readonly string[]).includes(x as (typeof KNOWN_ERROR_CODES)[number]);
}

/**
 * Normalize and validate a structured error payload for APIs and internal services.
 * Unknown `code` values are allowed but flagged in `warnings` for ops dashboards.
 */
export function normalizeStructuredErrorContract(raw: unknown): {
  ok: true;
  normalized: StructuredErrorContract;
  warnings: string[];
} | {
  ok: false;
  error: StructuredError;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "error body must be an object") };
  }
  const o = raw as Record<string, unknown>;
  const code = o.code;
  const message = o.message;
  if (typeof code !== "string" || !CODE_RE.test(code.trim())) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "code must match UPPER_SNAKE pattern") };
  }
  if (typeof message !== "string" || !message.trim()) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "message must be non-empty string") };
  }

  const warnings: string[] = [];
  if (!isKnownCode(code.trim())) {
    warnings.push(`code ${code.trim()} is not in KNOWN_ERROR_CODES`);
  }

  const severity = o.severity;
  if (severity !== undefined && severity !== null && !isSeverity(severity)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid severity") };
  }

  const subsystem = o.subsystem;
  if (subsystem !== undefined && subsystem !== null && !isSubsystem(subsystem)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid subsystem") };
  }

  const httpHint = o.http_status_hint;
  if (httpHint !== undefined && httpHint !== null) {
    const n = Number(httpHint);
    if (!Number.isInteger(n) || n < 400 || n > 599) {
      return { ok: false, error: validationError("VALIDATION_FAILED", "http_status_hint must be 400–599") };
    }
  }

  const retriable = o.retriable;
  if (retriable !== undefined && typeof retriable !== "boolean") {
    return { ok: false, error: validationError("VALIDATION_FAILED", "retriable must be boolean when set") };
  }

  const normalized: StructuredErrorContract = {
    code: code.trim(),
    message: message.trim(),
    ...(severity ? { severity: severity as StructuredErrorContract["severity"] } : {}),
    ...(typeof retriable === "boolean" ? { retriable } : {}),
    ...(httpHint != null ? { http_status_hint: Number(httpHint) } : {}),
    ...(o.details !== undefined ? { details: o.details } : {}),
    ...(typeof o.correlation_id === "string" ? { correlation_id: o.correlation_id } : {}),
    ...(typeof o.subsystem === "string" && o.subsystem ? { subsystem: o.subsystem } : {}),
  };

  return { ok: true, normalized, warnings };
}

/** Map normalized contract to legacy `StructuredError` for existing `sendStructuredError` callers. */
export function contractToStructuredError(c: StructuredErrorContract): StructuredError {
  return {
    code: c.code,
    message: c.message,
    details: {
      severity: c.severity,
      retriable: c.retriable,
      http_status_hint: c.http_status_hint,
      correlation_id: c.correlation_id,
      subsystem: c.subsystem,
      ...(c.details !== undefined ? { inner: c.details } : {}),
    },
  };
}

export function httpStatusFromContract(c: StructuredErrorContract): number {
  if (c.http_status_hint != null && Number.isInteger(c.http_status_hint)) {
    return c.http_status_hint;
  }
  if (c.severity === "critical" || c.severity === "error") return 500;
  return 400;
}
