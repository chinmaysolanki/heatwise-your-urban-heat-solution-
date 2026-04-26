import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import { RETENTION_ENTITY_CATEGORIES } from "@/lib/governanceConstants";
import type { UpsertRetentionCategoryInput } from "@/lib/governanceTypes";

function inList(v: string, list: readonly string[]): boolean {
  return list.includes(v);
}

const DEFAULT_POLICIES: Array<{
  entityCategory: string;
  defaultRetentionDays: number;
  archiveAfterDays: number | null;
  hardDeleteAfterDays: number | null;
  notes: Record<string, unknown>;
}> = [
  {
    entityCategory: "user_profile",
    defaultRetentionDays: 2555,
    archiveAfterDays: 730,
    hardDeleteAfterDays: null,
    notes: { basis: "account_lifecycle" },
  },
  {
    entityCategory: "project_media",
    defaultRetentionDays: 1095,
    archiveAfterDays: 180,
    hardDeleteAfterDays: 1095,
    notes: { basis: "user_projects" },
  },
  {
    entityCategory: "recommendation_telemetry",
    defaultRetentionDays: 1095,
    archiveAfterDays: 90,
    hardDeleteAfterDays: 1095,
    notes: { basis: "product_improvement" },
  },
  {
    entityCategory: "installer_commercial",
    defaultRetentionDays: 2555,
    archiveAfterDays: null,
    hardDeleteAfterDays: null,
    notes: { basis: "ledger" },
  },
  {
    entityCategory: "verified_outcomes",
    defaultRetentionDays: 3650,
    archiveAfterDays: null,
    hardDeleteAfterDays: null,
    notes: { basis: "training_ground_truth" },
  },
  {
    entityCategory: "integration_events",
    defaultRetentionDays: 400,
    archiveAfterDays: 90,
    hardDeleteAfterDays: 400,
    notes: { basis: "partner_audit" },
  },
  {
    entityCategory: "platform_audit",
    defaultRetentionDays: 2555,
    archiveAfterDays: 180,
    hardDeleteAfterDays: null,
    notes: { basis: "security_compliance" },
  },
  {
    entityCategory: "governance_records",
    defaultRetentionDays: 2555,
    archiveAfterDays: 365,
    hardDeleteAfterDays: null,
    notes: { basis: "legal_hold_exceptions" },
  },
];

export async function ensureDefaultRetentionPolicies(): Promise<void> {
  for (const d of DEFAULT_POLICIES) {
    await db.dataRetentionCategoryPolicy.upsert({
      where: { entityCategory: d.entityCategory },
      create: {
        entityCategory: d.entityCategory,
        defaultRetentionDays: d.defaultRetentionDays,
        archiveAfterDays: d.archiveAfterDays ?? undefined,
        hardDeleteAfterDays: d.hardDeleteAfterDays ?? undefined,
        notesJson: JSON.stringify(d.notes),
        policyVersion: "v1",
      },
      update: {
        defaultRetentionDays: d.defaultRetentionDays,
        archiveAfterDays: d.archiveAfterDays ?? undefined,
        hardDeleteAfterDays: d.hardDeleteAfterDays ?? undefined,
        notesJson: JSON.stringify(d.notes),
      },
    });
  }
}

export async function getRetentionSummary(): Promise<{
  ok: true;
  categories: unknown[];
  generatedAt: string;
}> {
  await ensureDefaultRetentionPolicies();
  const rows = await db.dataRetentionCategoryPolicy.findMany({
    orderBy: { entityCategory: "asc" },
  });
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    categories: rows.map((r) => ({
      entityCategory: r.entityCategory,
      defaultRetentionDays: r.defaultRetentionDays,
      archiveAfterDays: r.archiveAfterDays,
      hardDeleteAfterDays: r.hardDeleteAfterDays,
      policyVersion: r.policyVersion,
      notes: r.notesJson ? (JSON.parse(r.notesJson) as Record<string, unknown>) : null,
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

export async function upsertRetentionCategoryPolicy(
  input: UpsertRetentionCategoryInput,
): Promise<{ ok: true; id: string } | { ok: false; error: StructuredError }> {
  const cat = String(input.entityCategory || "").trim();
  if (!cat || !inList(cat, RETENTION_ENTITY_CATEGORIES)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "invalid entityCategory") };
  }
  const days = Number(input.defaultRetentionDays);
  if (!Number.isInteger(days) || days < 1 || days > 36500) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "defaultRetentionDays must be 1–36500") };
  }

  const arch = input.archiveAfterDays;
  if (arch != null && (!Number.isInteger(arch) || arch < 0 || arch > 36500)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "archiveAfterDays invalid") };
  }
  const hard = input.hardDeleteAfterDays;
  if (hard != null && (!Number.isInteger(hard) || hard < 0 || hard > 36500)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "hardDeleteAfterDays invalid") };
  }
  if (arch != null && hard != null && hard < arch) {
    return {
      ok: false,
      error: validationError("VALIDATION_FAILED", "hardDeleteAfterDays must be >= archiveAfterDays when both set"),
    };
  }

  const row = await db.dataRetentionCategoryPolicy.upsert({
    where: { entityCategory: cat },
    create: {
      entityCategory: cat,
      defaultRetentionDays: days,
      archiveAfterDays: arch ?? undefined,
      hardDeleteAfterDays: hard ?? undefined,
      notesJson: input.notes ? JSON.stringify(input.notes) : undefined,
      policyVersion: input.policyVersion?.trim() || "v1",
    },
    update: {
      defaultRetentionDays: days,
      archiveAfterDays: arch ?? undefined,
      hardDeleteAfterDays: hard ?? undefined,
      notesJson: input.notes ? JSON.stringify(input.notes) : undefined,
      ...(input.policyVersion ? { policyVersion: input.policyVersion.trim() } : {}),
    },
  });

  return { ok: true, id: row.id };
}
