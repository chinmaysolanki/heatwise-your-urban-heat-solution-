import type { FunnelStage } from "@/lib/commercialConstants";

export type LogRevenueEventInput = {
  /** When set, duplicate POSTs replay the same `revenueEventId` (scope `revenue_event`). */
  idempotencyKey?: string | null;
  eventType: string;
  eventTimestamp?: string | Date | null;
  userId?: string | null;
  projectId?: string | null;
  recommendationSessionId?: string | null;
  quoteRequestId?: string | null;
  installerQuoteId?: string | null;
  installJobId?: string | null;
  installerId?: string | null;
  currency?: string | null;
  grossAmount?: number | null;
  netAmount?: number | null;
  commissionAmount?: number | null;
  platformFeeAmount?: number | null;
  discountAmount?: number | null;
  refundAmount?: number | null;
  taxAmount?: number | null;
  revenueStatus: string;
  paymentStatus?: string | null;
  revenueSource: string;
  metadata?: Record<string, unknown> | null;
};

export type LogLeadFunnelEventInput = {
  eventType: string;
  eventTimestamp?: string | Date | null;
  userId?: string | null;
  projectId: string;
  recommendationSessionId?: string | null;
  quoteRequestId?: string | null;
  installerQuoteId?: string | null;
  installJobId?: string | null;
  installerId?: string | null;
  funnelStage: string;
  sourceChannel?: string | null;
  campaignId?: string | null;
  region?: string | null;
  projectType?: string | null;
  budgetBand?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type FunnelSummaryFilters = {
  windowStart: Date;
  windowEnd: Date;
  region?: string | null;
  projectType?: string | null;
  sourceChannel?: string | null;
  budgetBand?: string | null;
};

export type FunnelSummaryResult = {
  window: { startIso: string; endIso: string };
  filters: Record<string, string | null | undefined>;
  stageCounts: Record<string, number>;
  projectsWithStage: Record<string, number>;
  transitionRates: Record<string, number | null>;
  notes: string[];
};

export type UnitEconomicsFilters = {
  windowStart: Date;
  windowEnd: Date;
  region?: string | null;
  projectType?: string | null;
  sourceChannel?: string | null;
};

export type UnitEconomicsResult = {
  window: { startIso: string; endIso: string };
  filters: Record<string, string | null | undefined>;
  totalProjects: number;
  totalQuoteRequests: number;
  totalQuotesReceived: number;
  totalQuoteAcceptances: number;
  totalInstallsCompleted: number;
  quoteRequestToQuoteReceivedRate: number | null;
  quoteReceivedToAcceptanceRate: number | null;
  acceptanceToInstallRate: number | null;
  installConversionRate: number | null;
  avgRevenuePerProjectInr: number | null;
  avgRevenuePerInstallInr: number | null;
  avgPlatformMarginInr: number | null;
  avgQuoteValueInr: number | null;
  avgFinalInstallValueInr: number | null;
  avgTimeToQuoteHours: number | null;
  avgTimeToInstallDays: number | null;
  refundRate: number | null;
  repeatServiceRate: number | null;
};

export type InstallerCommercialFilters = {
  windowStart: Date;
  windowEnd: Date;
  installerId?: string | null;
  region?: string | null;
};

export type InstallerCommercialRow = {
  installerId: string;
  quotesSubmitted: number;
  quotesAccepted: number;
  installsCompleted: number;
  quoteAcceptanceRate: number | null;
  installCompletionRate: number | null;
  avgQuoteAmountInr: number | null;
  avgFinalInstallAmountInr: number | null;
  avgQuoteToFinalDeltaPct: number | null;
  totalInstallerRevenueInr: number | null;
  totalPlatformCommissionInr: number | null;
  cancellationRate: number | null;
  refundRate: number | null;
};

export type CohortSummaryFilters = UnitEconomicsFilters & {
  cohortGranularity?: "week" | "month";
};

export type CohortRow = {
  cohortLabel: string;
  region: string | null;
  projectType: string | null;
  sourceChannel: string | null;
  projectCount: number;
  installCount: number;
  revenueInr: number | null;
  repeatOrRenewalCount: number;
};
