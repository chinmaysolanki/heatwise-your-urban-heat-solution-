import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import {
  COMPLIANCE_STATUSES,
  PARTNER_ACTIVE_STATUSES,
} from "@/lib/partnerOperationsConstants";
import type { ServiceArea, UpsertPartnerProfileInput } from "@/lib/partnerOperationsTypes";

const CUID = /^c[a-z0-9]{24,}$/i;

function inEnum<T extends string>(v: string, list: readonly T[]): boolean {
  return (list as readonly string[]).includes(v);
}

function validateServiceAreas(areas: ServiceArea[]): StructuredError | null {
  for (const a of areas) {
    const code = String(a.region_code || "").trim();
    if (!code || code.length > 64) {
      return validationError("INVALID_SERVICE_AREA", "each service area needs region_code (1–64 chars)");
    }
    if (a.priority != null && (typeof a.priority !== "number" || a.priority < 0 || a.priority > 1000)) {
      return validationError("INVALID_SERVICE_AREA", "priority must be 0–1000 when set");
    }
  }
  return null;
}

export async function upsertPartnerOperationsProfile(
  input: UpsertPartnerProfileInput,
): Promise<{ ok: true; partnerOperationsProfileId: string } | { ok: false; error: StructuredError }> {
  const iid = String(input.installerId || "").trim();
  if (!CUID.test(iid)) {
    return { ok: false, error: validationError("INVALID_PARTNER_REFERENCE", "installerId must be cuid-like") };
  }

  const inst = await db.installerProfile.findUnique({ where: { id: iid }, select: { id: true } });
  if (!inst) {
    return { ok: false, error: validationError("NOT_FOUND", "installer profile not found") };
  }

  const areas = input.serviceAreas ?? [];
  const areaErr = validateServiceAreas(areas);
  if (areaErr) return { ok: false, error: areaErr };

  const cs = input.complianceStatus?.trim() || undefined;
  if (cs && !inEnum(cs, COMPLIANCE_STATUSES)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid complianceStatus") };
  }
  const pas = input.partnerActiveStatus?.trim() || undefined;
  if (pas && !inEnum(pas, PARTNER_ACTIVE_STATUSES)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid partnerActiveStatus") };
  }

  const row = await db.partnerOperationsProfile.upsert({
    where: { installerId: iid },
    create: {
      installerId: iid,
      organizationName: input.organizationName?.trim() || undefined,
      legalEntityName: input.legalEntityName?.trim() || undefined,
      serviceAreasJson: JSON.stringify(areas),
      complianceStatus: cs ?? "pending",
      partnerActiveStatus: pas ?? "operational",
      primaryContactJson: input.primaryContact ? JSON.stringify(input.primaryContact) : undefined,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
    update: {
      organizationName: input.organizationName?.trim() || undefined,
      legalEntityName: input.legalEntityName?.trim() || undefined,
      serviceAreasJson: JSON.stringify(areas),
      ...(cs ? { complianceStatus: cs } : {}),
      ...(pas ? { partnerActiveStatus: pas } : {}),
      primaryContactJson: input.primaryContact ? JSON.stringify(input.primaryContact) : undefined,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });

  return { ok: true, partnerOperationsProfileId: row.id };
}

export async function getPartnerOperationsProfile(installerId: string): Promise<{
  ok: true;
  profile: Record<string, unknown> | null;
} | { ok: false; error: StructuredError }> {
  const iid = String(installerId || "").trim();
  if (!CUID.test(iid)) {
    return { ok: false, error: validationError("INVALID_PARTNER_REFERENCE", "installerId must be cuid-like") };
  }
  const row = await db.partnerOperationsProfile.findUnique({ where: { installerId: iid } });
  if (!row) return { ok: true, profile: null };
  return {
    ok: true,
    profile: {
      installerId: row.installerId,
      organizationName: row.organizationName,
      legalEntityName: row.legalEntityName,
      serviceAreas: JSON.parse(row.serviceAreasJson || "[]") as unknown[],
      complianceStatus: row.complianceStatus,
      partnerActiveStatus: row.partnerActiveStatus,
      primaryContact: row.primaryContactJson ? (JSON.parse(row.primaryContactJson) as Record<string, unknown>) : null,
      metadata: row.metadataJson ? (JSON.parse(row.metadataJson) as Record<string, unknown>) : null,
      updatedAt: row.updatedAt.toISOString(),
    },
  };
}
