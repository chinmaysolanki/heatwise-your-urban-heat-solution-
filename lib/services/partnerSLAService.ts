import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

const CUID = /^c[a-z0-9]{24,}$/i;

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (24 * 3600 * 1000);
}

export type ComputedSLAMetrics = {
  installerId: string;
  windowStart: string;
  windowEnd: string;
  responseTimeMsP50: number | null;
  quoteTurnaroundHoursP50: number | null;
  siteVisitCompletionRate: number | null;
  installStartDelayDaysP50: number | null;
  verificationDelayDaysP50: number | null;
  jobSampleSize: number;
};

/**
 * Derive SLA-style metrics from quotes, jobs, and verified installs (compatible with commercial / installer ops tables).
 */
export async function computePartnerSLAMetrics(
  installerId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<{ ok: true; metrics: ComputedSLAMetrics } | { ok: false; error: StructuredError }> {
  const iid = String(installerId || "").trim();
  if (!CUID.test(iid)) {
    return { ok: false, error: validationError("INVALID_PARTNER_REFERENCE", "installerId must be cuid-like") };
  }

  const ws = windowStart.getTime();
  const we = windowEnd.getTime();
  if (!(we > ws)) {
    return { ok: false, error: validationError("VALIDATION_FAILED", "windowEnd must be after windowStart") };
  }

  const quotes = await db.installerQuote.findMany({
    where: {
      installerId: iid,
      quotedAt: { gte: windowStart, lte: windowEnd },
    },
    include: {
      quoteAssignment: true,
      quoteRequest: true,
    },
  });

  const responseMs: number[] = [];
  const turnaroundHrs: number[] = [];
  for (const q of quotes) {
    const qa = q.quoteAssignment;
    const qr = q.quoteRequest;
    if (qa?.assignedAt) {
      const d = q.quotedAt.getTime() - qa.assignedAt.getTime();
      if (d >= 0 && d < 365 * 24 * 3600 * 1000) responseMs.push(d);
    }
    if (qr?.requestedAt) {
      const h = (q.quotedAt.getTime() - qr.requestedAt.getTime()) / 3600000;
      if (h >= 0 && h < 24 * 365) turnaroundHrs.push(h);
    }
  }

  const jobs = await db.installerInstallJob.findMany({
    where: {
      installerId: iid,
      OR: [
        { startedAt: { gte: windowStart, lte: windowEnd } },
        { completedAt: { gte: windowStart, lte: windowEnd } },
        { scheduledDate: { gte: windowStart, lte: windowEnd } },
      ],
    },
    include: { sourceQuote: true },
  });

  const installDelays: number[] = [];
  for (const j of jobs) {
    if (j.startedAt && j.sourceQuote?.quotedAt) {
      const d = daysBetween(j.sourceQuote.quotedAt, j.startedAt);
      if (d >= 0 && d < 730) installDelays.push(d);
    }
  }

  const scheduledInWindow = jobs.filter((j) => j.scheduledDate && j.scheduledDate >= windowStart && j.scheduledDate <= windowEnd);
  const visited = scheduledInWindow.filter((j) => j.startedAt != null).length;
  const siteVisitCompletionRate =
    scheduledInWindow.length > 0 ? visited / scheduledInWindow.length : null;

  const verified = await db.verifiedInstallRecord.findMany({
    where: {
      installerId: iid,
      verifiedAt: { gte: windowStart, lte: windowEnd },
    },
    include: { installJob: true },
  });

  const verDelays: number[] = [];
  for (const v of verified) {
    const c = v.installJob?.completedAt;
    if (c) {
      const d = daysBetween(c, v.verifiedAt);
      if (d >= 0 && d < 365) verDelays.push(d);
    }
  }

  const metrics: ComputedSLAMetrics = {
    installerId: iid,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    responseTimeMsP50: median(responseMs) != null ? Math.round(median(responseMs)!) : null,
    quoteTurnaroundHoursP50: median(turnaroundHrs),
    siteVisitCompletionRate,
    installStartDelayDaysP50: median(installDelays),
    verificationDelayDaysP50: median(verDelays),
    jobSampleSize: jobs.length,
  };

  return { ok: true, metrics };
}

export async function persistPartnerSLAMetrics(metrics: ComputedSLAMetrics): Promise<void> {
  const ws = new Date(metrics.windowStart);
  const we = new Date(metrics.windowEnd);
  await db.partnerSLAMetrics.upsert({
    where: {
      installerId_windowStart_windowEnd: {
        installerId: metrics.installerId,
        windowStart: ws,
        windowEnd: we,
      },
    },
    create: {
      installerId: metrics.installerId,
      windowStart: ws,
      windowEnd: we,
      responseTimeMsP50: metrics.responseTimeMsP50 ?? undefined,
      quoteTurnaroundHoursP50: metrics.quoteTurnaroundHoursP50 ?? undefined,
      siteVisitCompletionRate: metrics.siteVisitCompletionRate ?? undefined,
      installStartDelayDaysP50: metrics.installStartDelayDaysP50 ?? undefined,
      verificationDelayDaysP50: metrics.verificationDelayDaysP50 ?? undefined,
      jobSampleSize: metrics.jobSampleSize,
    },
    update: {
      responseTimeMsP50: metrics.responseTimeMsP50 ?? undefined,
      quoteTurnaroundHoursP50: metrics.quoteTurnaroundHoursP50 ?? undefined,
      siteVisitCompletionRate: metrics.siteVisitCompletionRate ?? undefined,
      installStartDelayDaysP50: metrics.installStartDelayDaysP50 ?? undefined,
      verificationDelayDaysP50: metrics.verificationDelayDaysP50 ?? undefined,
      jobSampleSize: metrics.jobSampleSize,
      computedAt: new Date(),
    },
  });
}

export async function getPartnerSLASummary(
  installerId: string,
  windowStart?: Date,
  windowEnd?: Date,
  options?: { recompute?: boolean },
): Promise<
  | { ok: true; summary: Record<string, unknown> | null; source: "stored" | "computed" }
  | { ok: false; error: StructuredError }
> {
  const iid = String(installerId || "").trim();
  if (!CUID.test(iid)) {
    return { ok: false, error: validationError("INVALID_PARTNER_REFERENCE", "installerId must be cuid-like") };
  }

  const we = windowEnd ?? new Date();
  const ws = windowStart ?? new Date(we.getTime() - 30 * 24 * 3600 * 1000);

  if (options?.recompute) {
    const comp = await computePartnerSLAMetrics(iid, ws, we);
    if (!comp.ok) return comp;
    await persistPartnerSLAMetrics(comp.metrics);
    return {
      ok: true,
      source: "computed",
      summary: { ...comp.metrics, computedAt: new Date().toISOString() },
    };
  }

  const row = await db.partnerSLAMetrics.findUnique({
    where: {
      installerId_windowStart_windowEnd: {
        installerId: iid,
        windowStart: ws,
        windowEnd: we,
      },
    },
  });

  if (!row) {
    const comp = await computePartnerSLAMetrics(iid, ws, we);
    if (!comp.ok) return comp;
    return { ok: true, source: "computed", summary: { ...comp.metrics, computedAt: null, persisted: false } };
  }

  return {
    ok: true,
    source: "stored",
    summary: {
      installerId: row.installerId,
      windowStart: row.windowStart.toISOString(),
      windowEnd: row.windowEnd.toISOString(),
      responseTimeMsP50: row.responseTimeMsP50,
      quoteTurnaroundHoursP50: row.quoteTurnaroundHoursP50,
      siteVisitCompletionRate: row.siteVisitCompletionRate,
      installStartDelayDaysP50: row.installStartDelayDaysP50,
      verificationDelayDaysP50: row.verificationDelayDaysP50,
      jobSampleSize: row.jobSampleSize,
      computedAt: row.computedAt.toISOString(),
    },
  };
}
