export type UpsertConsentInput = {
  userId: string;
  consentScope: string;
  consentStatus: string;
  sourceChannel?: string | null;
  grantedAt?: string | Date | null;
  withdrawnAt?: string | Date | null;
  expiresAt?: string | Date | null;
  legalBasis?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CreatePolicyFlagInput = {
  flagType: string;
  severity: string;
  title: string;
  entityType?: string | null;
  entityId?: string | null;
  userId?: string | null;
  projectId?: string | null;
  detail?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type UpdatePolicyFlagInput = {
  flagId: string;
  status?: string | null;
  severity?: string | null;
  resolvedBy?: string | null;
  detail?: Record<string, unknown> | null;
};

export type UpsertRetentionCategoryInput = {
  entityCategory: string;
  defaultRetentionDays: number;
  archiveAfterDays?: number | null;
  hardDeleteAfterDays?: number | null;
  notes?: Record<string, unknown> | null;
  policyVersion?: string | null;
};

export type CreateGovernanceReviewInput = {
  reviewType: string;
  priority?: string | null;
  subjectEntityType: string;
  subjectEntityId: string;
  relatedUserId?: string | null;
  relatedProjectId?: string | null;
  openedByActorId?: string | null;
  openedByActorType?: string | null;
  findings?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type UpdateGovernanceReviewInput = {
  reviewId: string;
  status?: string | null;
  priority?: string | null;
  resolutionSummary?: string | null;
  assignedToActorId?: string | null;
  findings?: Record<string, unknown> | null;
};
