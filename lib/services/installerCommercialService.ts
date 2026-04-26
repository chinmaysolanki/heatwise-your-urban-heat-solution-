import { db } from "@/lib/db";

import type { InstallerCommercialFilters, InstallerCommercialRow } from "@/lib/commercialTypes";

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Descriptive installer commercial rollups (admin / ops); not used for ranking v1.
 */
export async function computeInstallerCommercialMetrics(
  f: InstallerCommercialFilters,
): Promise<InstallerCommercialRow[]> {
  const installerFilter = f.installerId ? { installerId: f.installerId } : {};

  const quotes = await db.installerQuote.findMany({
    where: {
      quotedAt: { gte: f.windowStart, lte: f.windowEnd },
      ...installerFilter,
    },
    select: {
      installerId: true,
      quoteAmountInr: true,
      quoteStatus: true,
      quoteRequest: { select: { userLocationRegion: true } },
    },
  });

  const jobs = await db.installerInstallJob.findMany({
    where: {
      OR: [
        { completedAt: { gte: f.windowStart, lte: f.windowEnd }, jobStatus: "completed" },
        { cancelledAt: { gte: f.windowStart, lte: f.windowEnd } },
      ],
      ...installerFilter,
    },
    select: {
      installerId: true,
      finalCostInr: true,
      estimatedCostInr: true,
      jobStatus: true,
      completedAt: true,
      cancelledAt: true,
    },
  });

  const rev = await db.revenueEvent.findMany({
    where: {
      eventTimestamp: { gte: f.windowStart, lte: f.windowEnd },
      installerId: { not: null },
      ...installerFilter,
    },
    select: {
      installerId: true,
      netAmount: true,
      grossAmount: true,
      commissionAmount: true,
      platformFeeAmount: true,
      refundAmount: true,
    },
  });

  const byInstaller = new Map<string, InstallerCommercialRow>();

  const ensure = (id: string): InstallerCommercialRow => {
    let r = byInstaller.get(id);
    if (!r) {
      r = {
        installerId: id,
        quotesSubmitted: 0,
        quotesAccepted: 0,
        installsCompleted: 0,
        quoteAcceptanceRate: null,
        installCompletionRate: null,
        avgQuoteAmountInr: null,
        avgFinalInstallAmountInr: null,
        avgQuoteToFinalDeltaPct: null,
        totalInstallerRevenueInr: null,
        totalPlatformCommissionInr: null,
        cancellationRate: null,
        refundRate: null,
      };
      byInstaller.set(id, r);
    }
    return r;
  };

  const quoteAmountsBy = new Map<string, number[]>();

  for (const q of quotes) {
    if (f.region && q.quoteRequest.userLocationRegion !== f.region) continue;
    const row = ensure(q.installerId);
    row.quotesSubmitted += 1;
    if (q.quoteStatus === "accepted") row.quotesAccepted += 1;
    if (!quoteAmountsBy.has(q.installerId)) quoteAmountsBy.set(q.installerId, []);
    quoteAmountsBy.get(q.installerId)!.push(q.quoteAmountInr);
  }

  const completedBy = new Map<string, number>();
  const cancelledBy = new Map<string, number>();
  const finalsBy = new Map<string, number[]>();

  for (const j of jobs) {
    const row = ensure(j.installerId);
    if (j.jobStatus === "completed" && j.completedAt) {
      row.installsCompleted += 1;
      completedBy.set(j.installerId, (completedBy.get(j.installerId) ?? 0) + 1);
      const fc = j.finalCostInr ?? j.estimatedCostInr;
      if (fc != null && fc > 0) {
        if (!finalsBy.has(j.installerId)) finalsBy.set(j.installerId, []);
        finalsBy.get(j.installerId)!.push(fc);
      }
    }
    if (j.cancelledAt) {
      cancelledBy.set(j.installerId, (cancelledBy.get(j.installerId) ?? 0) + 1);
    }
  }

  for (const [iid, amounts] of quoteAmountsBy) {
    const row = ensure(iid);
    row.avgQuoteAmountInr = avg(amounts);
    row.quoteAcceptanceRate = row.quotesSubmitted ? row.quotesAccepted / row.quotesSubmitted : null;
  }

  for (const [iid, finals] of finalsBy) {
    const row = ensure(iid);
    row.avgFinalInstallAmountInr = avg(finals);
  }

  const instRev = new Map<string, number>();
  const platComm = new Map<string, number>();
  const refunds = new Map<string, number>();
  const revCount = new Map<string, number>();

  for (const r of rev) {
    if (!r.installerId) continue;
    ensure(r.installerId);
    const net = r.netAmount ?? r.grossAmount ?? 0;
    instRev.set(r.installerId, (instRev.get(r.installerId) ?? 0) + net);
    platComm.set(r.installerId, (platComm.get(r.installerId) ?? 0) + (r.platformFeeAmount ?? 0));
    revCount.set(r.installerId, (revCount.get(r.installerId) ?? 0) + 1);
    if ((r.refundAmount ?? 0) > 0) {
      refunds.set(r.installerId, (refunds.get(r.installerId) ?? 0) + 1);
    }
  }

  for (const iid of byInstaller.keys()) {
    const row = ensure(iid);
    row.totalInstallerRevenueInr = instRev.get(iid) ?? 0;
    row.totalPlatformCommissionInr = platComm.get(iid) ?? 0;
    const subs = row.quotesSubmitted;
    const acc = row.quotesAccepted;
    row.installCompletionRate = acc > 0 ? row.installsCompleted / acc : null;
    const qavg = row.avgQuoteAmountInr;
    const favg = row.avgFinalInstallAmountInr;
    if (qavg != null && favg != null && qavg > 0) {
      row.avgQuoteToFinalDeltaPct = ((favg - qavg) / qavg) * 100;
    }
    const c = cancelledBy.get(iid) ?? 0;
    const denom = (completedBy.get(iid) ?? 0) + c;
    row.cancellationRate = denom > 0 ? c / denom : null;
    const rc = revCount.get(iid) ?? 0;
    row.refundRate = rc > 0 ? (refunds.get(iid) ?? 0) / rc : null;
  }

  return [...byInstaller.values()].sort((a, b) => b.quotesSubmitted - a.quotesSubmitted);
}

export async function persistInstallerCommercialSnapshots(
  f: InstallerCommercialFilters,
): Promise<{ count: number }> {
  const rows = await computeInstallerCommercialMetrics(f);
  let count = 0;
  for (const r of rows) {
    await db.installerCommercialMetrics.create({
      data: {
        installerId: r.installerId,
        windowStart: f.windowStart,
        windowEnd: f.windowEnd,
        region: f.region ?? undefined,
        quotesSubmitted: r.quotesSubmitted,
        quotesAccepted: r.quotesAccepted,
        installsCompleted: r.installsCompleted,
        quoteAcceptanceRate: r.quoteAcceptanceRate ?? undefined,
        installCompletionRate: r.installCompletionRate ?? undefined,
        avgQuoteAmountInr: r.avgQuoteAmountInr ?? undefined,
        avgFinalInstallAmountInr: r.avgFinalInstallAmountInr ?? undefined,
        avgQuoteToFinalDeltaPct: r.avgQuoteToFinalDeltaPct ?? undefined,
        totalInstallerRevenueInr: r.totalInstallerRevenueInr ?? undefined,
        totalPlatformCommissionInr: r.totalPlatformCommissionInr ?? undefined,
        cancellationRate: r.cancellationRate ?? undefined,
        refundRate: r.refundRate ?? undefined,
      },
    });
    count += 1;
  }
  return { count };
}
