import { db } from "@/lib/db";

import type { CohortRow, CohortSummaryFilters } from "@/lib/commercialTypes";

function weekLabel(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((x.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${x.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Coarse cohort slices for admin dashboards (project cohort by creation + funnel dimensions).
 */
export async function computeCohortSummary(f: CohortSummaryFilters): Promise<CohortRow[]> {
  const g = f.cohortGranularity === "month" ? monthLabel : weekLabel;

  const projects = await db.project.findMany({
    where: { createdAt: { gte: f.windowStart, lte: f.windowEnd } },
    select: { id: true, createdAt: true, primaryGoal: true, location: true },
  });

  const funnel = await db.leadFunnelEvent.findMany({
    where: {
      eventTimestamp: { gte: f.windowStart, lte: f.windowEnd },
      ...(f.region ? { region: f.region } : {}),
      ...(f.projectType ? { projectType: f.projectType } : {}),
      ...(f.sourceChannel ? { sourceChannel: f.sourceChannel } : {}),
    },
    select: { projectId: true, region: true, projectType: true, sourceChannel: true },
  });

  const funnelByProject = new Map<string, { region: string | null; projectType: string | null; sourceChannel: string | null }>();
  for (const e of funnel) {
    funnelByProject.set(e.projectId, {
      region: e.region ?? null,
      projectType: e.projectType ?? null,
      sourceChannel: e.sourceChannel ?? null,
    });
  }

  const jobs = await db.installerInstallJob.findMany({
    where: {
      projectId: { in: projects.map((p) => p.id) },
      jobStatus: "completed",
      completedAt: { not: null },
    },
    select: { projectId: true },
  });
  const installed = new Set(jobs.map((j) => j.projectId));

  const rev = await db.revenueEvent.findMany({
    where: {
      projectId: { in: projects.map((p) => p.id) },
      eventTimestamp: { gte: f.windowStart, lte: f.windowEnd },
    },
    select: { projectId: true, netAmount: true, grossAmount: true, eventType: true },
  });
  const revByProject = new Map<string, number>();
  const renewByProject = new Set<string>();
  for (const r of rev) {
    if (!r.projectId) continue;
    revByProject.set(r.projectId, (revByProject.get(r.projectId) ?? 0) + (r.netAmount ?? r.grossAmount ?? 0));
    if (r.eventType === "maintenance_plan_renewed" || r.eventType === "subscription_renewed") {
      renewByProject.add(r.projectId);
    }
  }

  type Key = string;
  const buckets = new Map<
    Key,
    { cohortLabel: string; region: string | null; projectType: string | null; sourceChannel: string | null; projects: Set<string> }
  >();

  for (const p of projects) {
    const fd = funnelByProject.get(p.id);
    const region = f.region ?? fd?.region ?? null;
    const projectType = f.projectType ?? fd?.projectType ?? p.primaryGoal ?? null;
    const sourceChannel = f.sourceChannel ?? fd?.sourceChannel ?? null;
    const cohortLabel = g(p.createdAt);
    const key = [cohortLabel, region ?? "", projectType ?? "", sourceChannel ?? ""].join("|");
    if (!buckets.has(key)) {
      buckets.set(key, { cohortLabel, region, projectType, sourceChannel, projects: new Set() });
    }
    buckets.get(key)!.projects.add(p.id);
  }

  const rows: CohortRow[] = [];
  for (const b of buckets.values()) {
    let installCount = 0;
    let revenueInr = 0;
    let repeatOrRenewalCount = 0;
    for (const pid of b.projects) {
      if (installed.has(pid)) installCount += 1;
      revenueInr += revByProject.get(pid) ?? 0;
      if (renewByProject.has(pid)) repeatOrRenewalCount += 1;
    }
    rows.push({
      cohortLabel: b.cohortLabel,
      region: b.region,
      projectType: b.projectType,
      sourceChannel: b.sourceChannel,
      projectCount: b.projects.size,
      installCount,
      revenueInr: revenueInr || null,
      repeatOrRenewalCount,
    });
  }

  rows.sort((a, b) => b.cohortLabel.localeCompare(a.cohortLabel));
  return rows;
}
