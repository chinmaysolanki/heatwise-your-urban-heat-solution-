import { db } from "@/lib/db";

function parseJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export type InstallerSearchFilters = {
  region: string;
  projectType?: string;
  solutionType?: string;
  budgetBand?: string;
  areaSqft?: number;
};

/**
 * Filter installer profiles by coverage and capability.
 * Regions/project types are **substring OR exact** list membership (case-insensitive for region).
 */
export async function searchInstallers(filters: InstallerSearchFilters) {
  const profiles = await db.installerProfile.findMany({
    where: { activeStatus: "active" },
    orderBy: { jobsCompletedCount: "desc" },
  });

  const regionLower = filters.region.trim().toLowerCase();
  const pt = filters.projectType?.trim().toLowerCase();
  const sol = filters.solutionType?.trim().toLowerCase();
  const bb = filters.budgetBand?.trim().toLowerCase();
  const area = filters.areaSqft;

  return profiles.filter((p) => {
    const regions = parseJsonArray(p.serviceRegionsJson).map((r) => r.toLowerCase());
    if (!regions.some((r) => r.includes(regionLower) || regionLower.includes(r))) {
      return false;
    }
    if (pt) {
      const pts = parseJsonArray(p.supportedProjectTypesJson).map((x) => x.toLowerCase());
      if (pts.length && !pts.some((x) => x === pt || x.includes(pt))) return false;
    }
    if (sol) {
      const sts = parseJsonArray(p.supportedSolutionTypesJson).map((x) => x.toLowerCase());
      if (sts.length && !sts.some((x) => x === sol || x.includes(sol))) return false;
    }
    if (bb) {
      const bands = parseJsonArray(p.supportedBudgetBandsJson).map((x) => x.toLowerCase());
      if (bands.length && !bands.includes(bb)) return false;
    }
    if (area != null && Number.isFinite(area)) {
      if (area < p.minJobSizeSqft) return false;
      if (p.maxJobSizeSqft != null && area > p.maxJobSizeSqft) return false;
    }
    return true;
  });
}

/** Synchronous check for assignment validation (same rules as ``searchInstallers``). */
export function profileMatchesFilters(
  p: {
    serviceRegionsJson: string;
    supportedProjectTypesJson: string;
    supportedSolutionTypesJson: string;
    supportedBudgetBandsJson: string;
    minJobSizeSqft: number;
    maxJobSizeSqft: number | null;
    activeStatus: string;
  },
  filters: InstallerSearchFilters,
): boolean {
  if (p.activeStatus !== "active") return false;
  const regionLower = filters.region.trim().toLowerCase();
  const regions = parseJsonArray(p.serviceRegionsJson).map((r) => r.toLowerCase());
  if (!regions.some((r) => r.includes(regionLower) || regionLower.includes(r))) return false;
  const pt = filters.projectType?.trim().toLowerCase();
  if (pt) {
    const pts = parseJsonArray(p.supportedProjectTypesJson).map((x) => x.toLowerCase());
    if (pts.length && !pts.some((x) => x === pt || x.includes(pt))) return false;
  }
  const sol = filters.solutionType?.trim().toLowerCase();
  if (sol) {
    const sts = parseJsonArray(p.supportedSolutionTypesJson).map((x) => x.toLowerCase());
    if (sts.length && !sts.some((x) => x === sol || x.includes(sol))) return false;
  }
  const bb = filters.budgetBand?.trim().toLowerCase();
  if (bb) {
    const bands = parseJsonArray(p.supportedBudgetBandsJson).map((x) => x.toLowerCase());
    if (bands.length && !bands.includes(bb)) return false;
  }
  const area = filters.areaSqft;
  if (area != null && Number.isFinite(area)) {
    if (area < p.minJobSizeSqft) return false;
    if (p.maxJobSizeSqft != null && area > p.maxJobSizeSqft) return false;
  }
  return true;
}
