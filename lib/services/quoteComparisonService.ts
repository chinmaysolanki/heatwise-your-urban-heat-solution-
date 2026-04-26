import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { QuoteComparisonDiagnostics } from "@/lib/ml/pricingTypes";

function pctErr(pred: number, actual: number): number {
  if (!Number.isFinite(pred) || pred === 0) return 0;
  return ((actual - pred) / pred) * 100;
}

export function buildQuoteComparisonDiagnostics(input: {
  predictedInstallMedianInr: number | null;
  quotedInstallCostInr: number | null;
  finalInstallCostInr: number | null;
  predictedAnnualMaintMedianInr?: number | null;
  actualAnnualMaintInr?: number | null;
}): QuoteComparisonDiagnostics {
  const pred = input.predictedInstallMedianInr;
  const quote = input.quotedInstallCostInr;
  const fin = input.finalInstallCostInr;
  const flags: string[] = [];

  let installCostErrorAbsInr: number | null = null;
  let installCostErrorPct: number | null = null;
  let quoteToFinalDeltaInr: number | null = null;
  let quoteToFinalDeltaPct: number | null = null;
  let pricingAccuracyBand = "unknown";
  let predictedVsActualNote: string | null = null;
  let quoteAlignmentNote: string | null = null;

  if (pred != null && quote != null) {
    installCostErrorAbsInr = quote - pred;
    installCostErrorPct = pctErr(pred, quote);
    const ap = Math.abs(installCostErrorPct);
    if (ap <= 12) {
      pricingAccuracyBand = "accurate_within_band";
      flags.push("accurate_within_band");
    } else if (quote > pred * 1.08) {
      pricingAccuracyBand = "underpredicted";
      flags.push("underpredicted");
    } else {
      pricingAccuracyBand = "overpredicted";
      flags.push("overpredicted");
    }
    quoteAlignmentNote = `Quote ${quote > pred ? "above" : "below"} HeatWise median estimate by ~${ap.toFixed(0)}%.`;
  }

  if (quote != null && fin != null) {
    quoteToFinalDeltaInr = fin - quote;
    quoteToFinalDeltaPct = pctErr(quote, fin);
    if (fin > quote * 1.1) {
      flags.push("quote_escalated_post_site_visit");
      predictedVsActualNote = "Final cost materially above quoted amount — scope or site surprises likely.";
    } else if (fin < quote * 0.92) {
      predictedVsActualNote = "Final cost below quote — possible scope trim or efficient execution.";
    }
    if (fin > quote * 1.15) {
      flags.push("scope_change_cost_increase");
    }
  }

  if (pred != null && fin != null && quote == null) {
    installCostErrorAbsInr = fin - pred;
    installCostErrorPct = pctErr(pred, fin);
    predictedVsActualNote = "Compared predicted median directly to final job cost (no mid-flight quote).";
  }

  if (input.predictedAnnualMaintMedianInr != null && input.actualAnnualMaintInr != null) {
    const d = input.actualAnnualMaintInr - input.predictedAnnualMaintMedianInr;
    if (Math.abs(d) > 5000) flags.push("maintenance_estimate_drift");
  }

  return {
    pricingAccuracyBand,
    flags,
    predictedVsActualNote,
    quoteAlignmentNote,
    installCostErrorAbsInr,
    installCostErrorPct,
    quoteToFinalDeltaInr,
    quoteToFinalDeltaPct,
  };
}

export async function persistQuoteComparisonRecord(data: Prisma.QuoteComparisonRecordCreateInput) {
  return db.quoteComparisonRecord.create({ data });
}

/**
 * Recent quote amounts in a region (proxy for installer_benchmark); optional pricing input.
 */
export async function medianQuotedAmountForRegion(region: string, limit = 40): Promise<number | null> {
  const rows = await db.installerQuoteRequest.findMany({
    where: { userLocationRegion: region },
    take: limit,
    orderBy: { requestedAt: "desc" },
    include: { quotes: { take: 3, orderBy: { quotedAt: "desc" } } },
  });
  const amounts: number[] = [];
  for (const r of rows) {
    for (const q of r.quotes) {
      if (q.quoteAmountInr > 0) amounts.push(q.quoteAmountInr);
    }
  }
  if (!amounts.length) return null;
  amounts.sort((a, b) => a - b);
  return amounts[Math.floor(amounts.length / 2)]!;
}
