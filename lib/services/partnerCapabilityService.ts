import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import {
  COMPLEXITY_BANDS,
  PROJECT_TYPES,
  SERVICE_READINESS,
  SOLUTION_TYPES,
} from "@/lib/partnerOperationsConstants";
import type { CapabilityMatchCriteria, UpsertPartnerCapabilityInput } from "@/lib/partnerOperationsTypes";

const CUID = /^c[a-z0-9]{24,}$/i;

function isSubset(values: string[], allowed: readonly string[]): boolean {
  return values.every((v) => (allowed as readonly string[]).includes(v));
}

export async function upsertPartnerCapabilityMatrix(
  input: UpsertPartnerCapabilityInput,
): Promise<{ ok: true; partnerCapabilityMatrixId: string } | { ok: false; error: StructuredError }> {
  const iid = String(input.installerId || "").trim();
  if (!CUID.test(iid)) {
    return { ok: false, error: validationError("INVALID_PARTNER_REFERENCE", "installerId must be cuid-like") };
  }

  const inst = await db.installerProfile.findUnique({ where: { id: iid }, select: { id: true } });
  if (!inst) {
    return { ok: false, error: validationError("NOT_FOUND", "installer profile not found") };
  }

  const pt = input.projectTypes ?? [];
  const st = input.solutionTypes ?? [];
  const cb = input.complexityBands ?? [];
  if (!isSubset(pt, PROJECT_TYPES)) {
    return { ok: false, error: validationError("INVALID_CAPABILITY_MATRIX", "unknown projectTypes entry") };
  }
  if (!isSubset(st, SOLUTION_TYPES)) {
    return { ok: false, error: validationError("INVALID_CAPABILITY_MATRIX", "unknown solutionTypes entry") };
  }
  if (!isSubset(cb, COMPLEXITY_BANDS)) {
    return { ok: false, error: validationError("INVALID_CAPABILITY_MATRIX", "unknown complexityBands entry") };
  }

  const sr = input.serviceReadiness?.trim() || "ready";
  if (!(SERVICE_READINESS as readonly string[]).includes(sr)) {
    return { ok: false, error: validationError("INVALID_READINESS_STATE", "invalid serviceReadiness") };
  }

  const row = await db.partnerCapabilityMatrix.upsert({
    where: { installerId: iid },
    create: {
      installerId: iid,
      projectTypesJson: JSON.stringify(pt),
      solutionTypesJson: JSON.stringify(st),
      complexityBandsJson: JSON.stringify(cb),
      seasonalConstraintsJson: JSON.stringify(input.seasonalConstraints ?? {}),
      serviceReadiness: sr,
      matrixExtrasJson: input.matrixExtras ? JSON.stringify(input.matrixExtras) : undefined,
    },
    update: {
      projectTypesJson: JSON.stringify(pt),
      solutionTypesJson: JSON.stringify(st),
      complexityBandsJson: JSON.stringify(cb),
      seasonalConstraintsJson: JSON.stringify(input.seasonalConstraints ?? {}),
      serviceReadiness: sr,
      matrixExtrasJson: input.matrixExtras ? JSON.stringify(input.matrixExtras) : undefined,
    },
  });

  return { ok: true, partnerCapabilityMatrixId: row.id };
}

export async function getPartnerCapabilityMatrix(
  installerId: string,
): Promise<{ ok: true; matrix: Record<string, unknown> | null } | { ok: false; error: StructuredError }> {
  const iid = String(installerId || "").trim();
  if (!CUID.test(iid)) {
    return { ok: false, error: validationError("INVALID_PARTNER_REFERENCE", "installerId must be cuid-like") };
  }
  const row = await db.partnerCapabilityMatrix.findUnique({ where: { installerId: iid } });
  if (!row) return { ok: true, matrix: null };
  return {
    ok: true,
    matrix: {
      installerId: row.installerId,
      projectTypes: JSON.parse(row.projectTypesJson || "[]") as string[],
      solutionTypes: JSON.parse(row.solutionTypesJson || "[]") as string[],
      complexityBands: JSON.parse(row.complexityBandsJson || "[]") as string[],
      seasonalConstraints: JSON.parse(row.seasonalConstraintsJson || "{}") as Record<string, unknown>,
      serviceReadiness: row.serviceReadiness,
      matrixExtras: row.matrixExtrasJson ? (JSON.parse(row.matrixExtrasJson) as Record<string, unknown>) : null,
      updatedAt: row.updatedAt.toISOString(),
    },
  };
}

/**
 * Returns whether the partner matrix supports the requested criteria (all provided dimensions must match).
 */
export async function matchPartnerCapabilities(
  installerId: string,
  criteria: CapabilityMatchCriteria,
): Promise<
  { ok: true; matches: boolean; reasons: string[] } | { ok: false; error: StructuredError }
> {
  const m = await getPartnerCapabilityMatrix(installerId);
  if (!m.ok) return m;
  if (!m.matrix) {
    return { ok: true, matches: false, reasons: ["no_capability_matrix"] };
  }

  const reasons: string[] = [];
  const pt = m.matrix.projectTypes as string[];
  const st = m.matrix.solutionTypes as string[];
  const cb = m.matrix.complexityBands as string[];
  const readiness = String(m.matrix.serviceReadiness || "");

  if (readiness === "not_accepting") {
    reasons.push("service_readiness_not_accepting");
    return { ok: true, matches: false, reasons };
  }

  if (criteria.projectType && !pt.includes(criteria.projectType)) {
    reasons.push("project_type_not_supported");
  }
  if (criteria.solutionType && !st.includes(criteria.solutionType)) {
    reasons.push("solution_type_not_supported");
  }
  if (criteria.complexityBand && !cb.includes(criteria.complexityBand)) {
    reasons.push("complexity_band_not_supported");
  }

  return { ok: true, matches: reasons.length === 0, reasons };
}
