import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

/**
 * Rebuilds `CommercialOutcome` for a project from telemetry, quotes, jobs, and revenue rows.
 */
export async function refreshCommercialOutcome(
  projectId: string,
): Promise<{ ok: true; commercialOutcomeId: string } | { ok: false; error: StructuredError }> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true, location: true, primaryGoal: true },
  });
  if (!project) return { ok: false, error: validationError("NOT_FOUND", "project not found") };

  const firstRec = await db.recommendationTelemetrySession.findFirst({
    where: { projectId },
    orderBy: { generatedAt: "asc" },
    select: { generatedAt: true },
  });

  const qr = await db.installerQuoteRequest.findMany({
    where: { projectId },
    orderBy: { requestedAt: "asc" },
    select: { requestedAt: true, userLocationRegion: true },
  });

  const quotes = await db.installerQuote.findMany({
    where: { quoteRequest: { projectId } },
    orderBy: { quotedAt: "asc" },
    select: { quotedAt: true, quoteStatus: true, quoteAmountInr: true, installerId: true },
  });

  const jobs = await db.installerInstallJob.findMany({
    where: { projectId },
    orderBy: { startedAt: "asc" },
    select: {
      installerId: true,
      completedAt: true,
      finalCostInr: true,
      jobStatus: true,
    },
  });

  const accepted = quotes.filter((q) => q.quoteStatus === "accepted");
  const completedJob = jobs.find((j) => j.jobStatus === "completed" && j.completedAt);

  const rev = await db.revenueEvent.findMany({
    where: { projectId },
    select: {
      grossAmount: true,
      netAmount: true,
      platformFeeAmount: true,
      discountAmount: true,
      refundAmount: true,
      commissionAmount: true,
    },
  });

  let gross = 0;
  let net = 0;
  let margin = 0;
  let disc = 0;
  let ref = 0;
  let instRev = 0;
  for (const r of rev) {
    gross += r.grossAmount ?? r.netAmount ?? 0;
    net += r.netAmount ?? r.grossAmount ?? 0;
    margin += r.platformFeeAmount ?? 0;
    disc += r.discountAmount ?? 0;
    ref += r.refundAmount ?? 0;
    instRev += r.commissionAmount ?? 0;
  }

  const firstQuoteReq = qr[0];
  const firstQuote = quotes[0];
  const firstAccept = accepted[0];

  let timeToQuoteHours: number | null = null;
  if (firstRec && firstQuote) {
    timeToQuoteHours =
      (firstQuote.quotedAt.getTime() - firstRec.generatedAt.getTime()) / (1000 * 60 * 60);
  }

  let timeToInstallDays: number | null = null;
  if (firstAccept && completedJob?.completedAt) {
    timeToInstallDays =
      (completedJob.completedAt.getTime() - firstAccept.quotedAt.getTime()) / (1000 * 60 * 60 * 24);
  }

  const quotesReceivedCount = quotes.length;
  const quoteAcceptanceRate = quotesReceivedCount ? accepted.length / quotesReceivedCount : null;

  let commercialStatus = "exploring";
  if (completedJob) commercialStatus = "installed";
  else if (accepted.length) commercialStatus = "accepted";
  else if (quotes.length) commercialStatus = "quoted";
  if (ref > gross && gross >= 0) commercialStatus = "refunded";

  const primaryInstallerId = completedJob?.installerId ?? accepted[0]?.installerId ?? quotes[0]?.installerId;

  const row = await db.commercialOutcome.upsert({
    where: { projectId },
    create: {
      projectId,
      userId: project.userId,
      installerId: primaryInstallerId ?? undefined,
      region: firstQuoteReq?.userLocationRegion ?? undefined,
      projectType: project.primaryGoal ?? undefined,
      firstRecommendationAt: firstRec?.generatedAt ?? undefined,
      firstQuoteRequestedAt: firstQuoteReq?.requestedAt ?? undefined,
      firstQuoteReceivedAt: firstQuote?.quotedAt ?? undefined,
      quoteAcceptedAt: firstAccept?.quotedAt ?? undefined,
      installCompletedAt: completedJob?.completedAt ?? undefined,
      timeToQuoteHours: timeToQuoteHours ?? undefined,
      timeToInstallDays: timeToInstallDays ?? undefined,
      quotesReceivedCount,
      quoteAcceptanceRate: quoteAcceptanceRate ?? undefined,
      grossRevenueInr: gross || undefined,
      netRevenueInr: net || undefined,
      platformMarginInr: margin || undefined,
      totalDiscountInr: disc || undefined,
      refundTotalInr: ref || undefined,
      customerLtvInr: net || undefined,
      installerRevenueInr: instRev || undefined,
      commercialStatus,
    },
    update: {
      userId: project.userId,
      installerId: primaryInstallerId ?? undefined,
      region: firstQuoteReq?.userLocationRegion ?? undefined,
      projectType: project.primaryGoal ?? undefined,
      firstRecommendationAt: firstRec?.generatedAt ?? undefined,
      firstQuoteRequestedAt: firstQuoteReq?.requestedAt ?? undefined,
      firstQuoteReceivedAt: firstQuote?.quotedAt ?? undefined,
      quoteAcceptedAt: firstAccept?.quotedAt ?? undefined,
      installCompletedAt: completedJob?.completedAt ?? undefined,
      timeToQuoteHours: timeToQuoteHours ?? undefined,
      timeToInstallDays: timeToInstallDays ?? undefined,
      quotesReceivedCount,
      quoteAcceptanceRate: quoteAcceptanceRate ?? undefined,
      grossRevenueInr: gross || undefined,
      netRevenueInr: net || undefined,
      platformMarginInr: margin || undefined,
      totalDiscountInr: disc || undefined,
      refundTotalInr: ref || undefined,
      customerLtvInr: net || undefined,
      installerRevenueInr: instRev || undefined,
      commercialStatus,
    },
  });

  return { ok: true, commercialOutcomeId: row.id };
}
