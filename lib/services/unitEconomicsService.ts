import { db } from "@/lib/db";

import type { UnitEconomicsFilters, UnitEconomicsResult } from "@/lib/commercialTypes";

async function projectIdsMatchingSlice(f: UnitEconomicsFilters): Promise<string[] | null> {
  if (!f.region && !f.projectType && !f.sourceChannel) return null;

  const ev = await db.leadFunnelEvent.findMany({
    where: {
      eventTimestamp: { gte: f.windowStart, lte: f.windowEnd },
      ...(f.region ? { region: f.region } : {}),
      ...(f.projectType ? { projectType: f.projectType } : {}),
      ...(f.sourceChannel ? { sourceChannel: f.sourceChannel } : {}),
    },
    select: { projectId: true },
    distinct: ["projectId"],
  });
  return ev.map((e) => e.projectId);
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Computes KPI rollups for admin dashboards (read-mostly aggregates over operational tables).
 */
export async function computeUnitEconomics(f: UnitEconomicsFilters): Promise<UnitEconomicsResult> {
  const sliceIds = await projectIdsMatchingSlice(f);

  const projectWhere = {
    createdAt: { gte: f.windowStart, lte: f.windowEnd },
    ...(sliceIds ? { id: { in: sliceIds } } : {}),
  };

  const totalProjects = await db.project.count({ where: projectWhere });

  const quoteReqWhere = {
    requestedAt: { gte: f.windowStart, lte: f.windowEnd },
    ...(sliceIds?.length ? { projectId: { in: sliceIds } } : {}),
  };
  const totalQuoteRequests = await db.installerQuoteRequest.count({ where: quoteReqWhere });

  const quotesWhere = {
    quotedAt: { gte: f.windowStart, lte: f.windowEnd },
    ...(sliceIds?.length ? { quoteRequest: { projectId: { in: sliceIds } } } : {}),
  };
  const quotes = await db.installerQuote.findMany({
    where: quotesWhere,
    select: { quoteAmountInr: true, quoteStatus: true, quoteRequestId: true },
  });
  const totalQuotesReceived = quotes.length;
  const totalQuoteAcceptances = quotes.filter((q) => q.quoteStatus === "accepted").length;

  const jobsWhere = {
    completedAt: { gte: f.windowStart, lte: f.windowEnd, not: null },
    jobStatus: "completed",
    ...(sliceIds?.length ? { projectId: { in: sliceIds } } : {}),
  };
  const completedJobs = await db.installerInstallJob.findMany({
    where: jobsWhere,
    select: { finalCostInr: true, estimatedCostInr: true, projectId: true },
  });
  const totalInstallsCompleted = completedJobs.length;
  const installedProjectIds = new Set(completedJobs.map((j) => j.projectId));

  const rate = (num: number, den: number): number | null => (den > 0 ? num / den : null);

  const revenueWhere = {
    eventTimestamp: { gte: f.windowStart, lte: f.windowEnd },
    revenueStatus: { in: ["recorded", "settled", "pending_settlement"] },
    ...(sliceIds?.length ? { projectId: { in: sliceIds } } : {}),
  };
  const revRows = await db.revenueEvent.findMany({
    where: revenueWhere,
    select: {
      netAmount: true,
      grossAmount: true,
      platformFeeAmount: true,
      refundAmount: true,
      projectId: true,
    },
  });

  const netList = revRows.map((r) => r.netAmount ?? r.grossAmount ?? 0).filter((x) => x > 0);
  const marginList = revRows.map((r) => r.platformFeeAmount ?? 0).filter((x) => x > 0);
  const refundList = revRows.filter((r) => (r.refundAmount ?? 0) > 0);

  const byProject = new Map<string, number>();
  let revenueOnInstalledProjects = 0;
  for (const r of revRows) {
    if (!r.projectId) continue;
    const v = r.netAmount ?? r.grossAmount ?? 0;
    byProject.set(r.projectId, (byProject.get(r.projectId) ?? 0) + v);
    if (installedProjectIds.has(r.projectId)) revenueOnInstalledProjects += v;
  }

  const quoteAmounts = quotes.map((q) => q.quoteAmountInr);
  const finalCosts = completedJobs.map((j) => j.finalCostInr ?? j.estimatedCostInr ?? 0).filter((x) => x > 0);

  const repeatWhere = {
    eventTimestamp: { gte: f.windowStart, lte: f.windowEnd },
    eventType: { in: ["maintenance_plan_renewed", "subscription_renewed"] },
    ...(sliceIds?.length ? { projectId: { in: sliceIds } } : {}),
  };
  const renewals = await db.revenueEvent.count({ where: repeatWhere });

  return {
    window: { startIso: f.windowStart.toISOString(), endIso: f.windowEnd.toISOString() },
    filters: { region: f.region, projectType: f.projectType, sourceChannel: f.sourceChannel },
    totalProjects,
    totalQuoteRequests,
    totalQuotesReceived,
    totalQuoteAcceptances,
    totalInstallsCompleted,
    quoteRequestToQuoteReceivedRate: rate(totalQuotesReceived, totalQuoteRequests),
    quoteReceivedToAcceptanceRate: rate(totalQuoteAcceptances, totalQuotesReceived),
    acceptanceToInstallRate: rate(totalInstallsCompleted, totalQuoteAcceptances),
    installConversionRate: rate(totalInstallsCompleted, Math.max(totalProjects, 1)),
    avgRevenuePerProjectInr: byProject.size ? avg([...byProject.values()]) : avg(netList),
    avgRevenuePerInstallInr:
      totalInstallsCompleted > 0 ? revenueOnInstalledProjects / totalInstallsCompleted : null,
    avgPlatformMarginInr: avg(marginList),
    avgQuoteValueInr: avg(quoteAmounts),
    avgFinalInstallValueInr: avg(finalCosts),
    avgTimeToQuoteHours: null,
    avgTimeToInstallDays: null,
    refundRate: rate(refundList.length, revRows.length || 1),
    repeatServiceRate: rate(renewals, totalProjects || 1),
  };
}

/**
 * Persist a snapshot row for audit / export pipelines.
 */
export async function persistUnitEconomicsSnapshot(
  f: UnitEconomicsFilters,
  meta?: Record<string, unknown> | null,
): Promise<{ snapshotId: string }> {
  const k = await computeUnitEconomics(f);
  const row = await db.unitEconomicsSnapshot.create({
    data: {
      windowStart: f.windowStart,
      windowEnd: f.windowEnd,
      region: f.region ?? undefined,
      projectType: f.projectType ?? undefined,
      sourceChannel: f.sourceChannel ?? undefined,
      totalProjects: k.totalProjects,
      totalQuoteRequests: k.totalQuoteRequests,
      totalQuotesReceived: k.totalQuotesReceived,
      totalQuoteAcceptances: k.totalQuoteAcceptances,
      totalInstallsCompleted: k.totalInstallsCompleted,
      quoteRequestToQuoteReceivedRate: k.quoteRequestToQuoteReceivedRate ?? undefined,
      quoteReceivedToAcceptanceRate: k.quoteReceivedToAcceptanceRate ?? undefined,
      acceptanceToInstallRate: k.acceptanceToInstallRate ?? undefined,
      installConversionRate: k.installConversionRate ?? undefined,
      avgRevenuePerProjectInr: k.avgRevenuePerProjectInr ?? undefined,
      avgRevenuePerInstallInr: k.avgRevenuePerInstallInr ?? undefined,
      avgPlatformMarginInr: k.avgPlatformMarginInr ?? undefined,
      avgQuoteValueInr: k.avgQuoteValueInr ?? undefined,
      avgFinalInstallValueInr: k.avgFinalInstallValueInr ?? undefined,
      avgTimeToQuoteHours: k.avgTimeToQuoteHours ?? undefined,
      avgTimeToInstallDays: k.avgTimeToInstallDays ?? undefined,
      refundRate: k.refundRate ?? undefined,
      repeatServiceRate: k.repeatServiceRate ?? undefined,
      metadataJson: meta ? JSON.stringify(meta) : undefined,
    },
  });
  return { snapshotId: row.id };
}
