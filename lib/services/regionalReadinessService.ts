import type { MaterialInventory, SpeciesAvailability } from "@prisma/client";

import { db } from "@/lib/db";

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Aggregate installer coverage from profiles whose service region list contains ``region``.
 */
export async function installerCoverageSignal(region: string): Promise<number> {
  const installers = await db.installerProfile.findMany({
    where: { activeStatus: "active" },
    select: { serviceRegionsJson: true, jobsCompletedCount: true, verificationStatus: true },
  });
  let weighted = 0;
  let wsum = 0;
  for (const p of installers) {
    const regs = parseJsonArray(p.serviceRegionsJson).map((r) => r.toLowerCase());
    if (!regs.includes(region.toLowerCase())) continue;
    const w = 1 + Math.min(50, p.jobsCompletedCount) / 50;
    const ver = p.verificationStatus === "verified" ? 1 : 0.75;
    weighted += w * ver;
    wsum += w;
  }
  if (wsum === 0) return 0.35;
  return Math.min(1, weighted / wsum);
}

export async function listRegionalReadiness(region: string, projectType?: string) {
  return db.regionalSupplyReadiness.findMany({
    where: {
      region,
      ...(projectType ? { projectType } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
}

export type ReadinessAggregate = {
  installerCoverageScore: number;
  speciesAvailabilityScore: number;
  materialsAvailabilityScore: number;
  irrigationReadinessScore: number;
  structuralExecutionReadinessScore: number;
  seasonalReadinessScore: number;
  overallSupplyReadinessScore: number;
};

function avg(nums: number[]): number {
  const f = nums.filter((n) => Number.isFinite(n));
  if (!f.length) return 0;
  return f.reduce((a, b) => a + b, 0) / f.length;
}

export function aggregateReadinessRows(rows: ReadinessAggregate[]): ReadinessAggregate | null {
  if (!rows.length) return null;
  return {
    installerCoverageScore: avg(rows.map((r) => r.installerCoverageScore)),
    speciesAvailabilityScore: avg(rows.map((r) => r.speciesAvailabilityScore)),
    materialsAvailabilityScore: avg(rows.map((r) => r.materialsAvailabilityScore)),
    irrigationReadinessScore: avg(rows.map((r) => r.irrigationReadinessScore)),
    structuralExecutionReadinessScore: avg(rows.map((r) => r.structuralExecutionReadinessScore)),
    seasonalReadinessScore: avg(rows.map((r) => r.seasonalReadinessScore)),
    overallSupplyReadinessScore: avg(rows.map((r) => r.overallSupplyReadinessScore)),
  };
}

/**
 * Recompute and upsert one readiness row per (region, projectType, solutionType) using
 * DB inventory + installer signal. Call from ops/cron when curated rows are missing.
 */
export async function recomputeRegionalReadinessForSolution(params: {
  region: string;
  projectType: string;
  solutionType: string;
}): Promise<void> {
  const { region, projectType, solutionType } = params;
  const [species, materials, installerCov, existing] = await Promise.all([
    db.speciesAvailability.findMany({ where: { region } }),
    db.materialInventory.findMany({ where: { region } }),
    installerCoverageSignal(region),
    db.regionalSupplyReadiness.findUnique({
      where: {
        region_projectType_solutionType: { region, projectType, solutionType },
      },
    }),
  ]);

  const speciesScore =
    species.length === 0
      ? 0.5
      : species.reduce((s: number, r: SpeciesAvailability) => s + (r.availabilityConfidence || 0), 0) /
        species.length;
  const matScore =
    materials.length === 0
      ? 0.5
      : materials.reduce(
          (s: number, m: MaterialInventory) =>
            s + (m.stockBand === "out" ? 0 : m.stockBand === "low" ? 0.5 : 1),
          0,
        ) / materials.length;

  const row: ReadinessAggregate = {
    installerCoverageScore: installerCov,
    speciesAvailabilityScore: Math.min(1, speciesScore),
    materialsAvailabilityScore: Math.min(1, matScore),
    irrigationReadinessScore: existing?.irrigationReadinessScore ?? 0.55,
    structuralExecutionReadinessScore: existing?.structuralExecutionReadinessScore ?? 0.55,
    seasonalReadinessScore: existing?.seasonalReadinessScore ?? 0.6,
    overallSupplyReadinessScore: 0,
  };
  row.overallSupplyReadinessScore = Math.min(
    1,
    (row.installerCoverageScore +
      row.speciesAvailabilityScore +
      row.materialsAvailabilityScore +
      row.irrigationReadinessScore +
      row.structuralExecutionReadinessScore +
      row.seasonalReadinessScore) /
      6,
  );

  await db.regionalSupplyReadiness.upsert({
    where: { region_projectType_solutionType: { region, projectType, solutionType } },
    create: {
      region,
      projectType,
      solutionType,
      ...row,
    },
    update: { ...row },
  });
}
