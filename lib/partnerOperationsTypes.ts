export type ServiceArea = {
  region_code: string;
  label?: string;
  priority?: number;
  service_tier?: "standard" | "priority" | "pilot";
};

export type UpsertPartnerProfileInput = {
  installerId: string;
  organizationName?: string | null;
  legalEntityName?: string | null;
  serviceAreas?: ServiceArea[];
  complianceStatus?: string | null;
  partnerActiveStatus?: string | null;
  primaryContact?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type UpsertPartnerCapabilityInput = {
  installerId: string;
  projectTypes?: string[];
  solutionTypes?: string[];
  complexityBands?: string[];
  seasonalConstraints?: Record<string, unknown>;
  serviceReadiness?: string | null;
  matrixExtras?: Record<string, unknown> | null;
};

export type CapabilityMatchCriteria = {
  projectType?: string | null;
  solutionType?: string | null;
  complexityBand?: string | null;
};

export type UpsertFieldOpsStatusInput = {
  installerId: string;
  availabilityState?: string | null;
  pauseState?: string | null;
  overloadSignal?: string | null;
  coverageGaps?: unknown[] | null;
  regionalReadiness?: Record<string, unknown>;
  signalNotes?: Record<string, unknown> | null;
};

export type SLASummaryQuery = {
  installerId: string;
  windowStart?: string | Date | null;
  windowEnd?: string | Date | null;
};
