import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import { CONSENT_SCOPES, CONSENT_STATUSES } from "@/lib/governanceConstants";
import type { UpsertConsentInput } from "@/lib/governanceTypes";

const CUID = /^c[a-z0-9]{24,}$/i;

function inList(v: string, list: readonly string[]): boolean {
  return list.includes(v);
}

export async function upsertUserConsent(
  input: UpsertConsentInput,
): Promise<{ ok: true; userConsentRecordId: string } | { ok: false; error: StructuredError }> {
  const uid = String(input.userId || "").trim();
  if (!CUID.test(uid)) {
    return { ok: false, error: validationError("INVALID_REFERENCE", "userId must be cuid-like") };
  }
  const scope = String(input.consentScope || "").trim();
  if (!inList(scope, CONSENT_SCOPES)) {
    return { ok: false, error: validationError("INVALID_CONSENT_SCOPE", "consentScope not recognized") };
  }
  const st = String(input.consentStatus || "").trim();
  if (!inList(st, CONSENT_STATUSES)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid consentStatus") };
  }

  const user = await db.user.findUnique({ where: { id: uid }, select: { id: true } });
  if (!user) {
    return { ok: false, error: validationError("NOT_FOUND", "user not found") };
  }

  const row = await db.userConsentRecord.upsert({
    where: { userId_consentScope: { userId: uid, consentScope: scope } },
    create: {
      userId: uid,
      consentScope: scope,
      consentStatus: st,
      sourceChannel: input.sourceChannel?.trim() || undefined,
      grantedAt: input.grantedAt ? new Date(input.grantedAt) : st === "granted" ? new Date() : undefined,
      withdrawnAt: input.withdrawnAt ? new Date(input.withdrawnAt) : st === "withdrawn" ? new Date() : undefined,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      legalBasis: input.legalBasis?.trim() || undefined,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
    update: {
      consentStatus: st,
      sourceChannel: input.sourceChannel?.trim() || undefined,
      grantedAt: input.grantedAt ? new Date(input.grantedAt) : undefined,
      withdrawnAt: input.withdrawnAt ? new Date(input.withdrawnAt) : st === "withdrawn" ? new Date() : undefined,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      legalBasis: input.legalBasis?.trim() || undefined,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });

  return { ok: true, userConsentRecordId: row.id };
}

export async function listUserConsents(
  userId: string,
): Promise<{ ok: true; items: unknown[] } | { ok: false; error: StructuredError }> {
  const uid = String(userId || "").trim();
  if (!CUID.test(uid)) {
    return { ok: false, error: validationError("INVALID_REFERENCE", "userId must be cuid-like") };
  }
  const rows = await db.userConsentRecord.findMany({
    where: { userId: uid },
    orderBy: { updatedAt: "desc" },
  });
  return {
    ok: true,
    items: rows.map((r) => ({
      id: r.id,
      consentScope: r.consentScope,
      consentStatus: r.consentStatus,
      sourceChannel: r.sourceChannel,
      grantedAt: r.grantedAt?.toISOString() ?? null,
      withdrawnAt: r.withdrawnAt?.toISOString() ?? null,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      legalBasis: r.legalBasis,
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}
