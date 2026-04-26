import type { DossierType } from "@/lib/reportingConstants";

export type AssembleRecommendationDossierInput = {
  recommendationSessionId: string;
  dossierType: DossierType;
  dossierVersion?: string;
  userId?: string | null;
  selectedCandidateSnapshotId?: string | null;
  overrides?: {
    scenarioSummary?: Record<string, unknown>;
    personalizationSummary?: Record<string, unknown>;
    feasibilitySummary?: Record<string, unknown>;
    executionNotes?: Record<string, unknown>;
    installerReadiness?: Record<string, unknown>;
  };
};

export type ReportPayloadView = {
  dossier: {
    id: string;
    dossierType: string;
    dossierVersion: string;
    generatedAt: string;
    projectId: string;
    recommendationSessionId: string;
    selectedCandidateSnapshotId: string | null;
    candidateSnapshotIds: string[];
  };
  sections: Array<{
    sectionKey: string;
    sectionOrder: number;
    sectionTitle: string;
    sectionType: string;
    visibilityScope: string;
    payload: Record<string, unknown>;
    explanationRefs: unknown;
  }>;
  explanations?: Array<{
    relatedSectionKey: string;
    explanationType: string;
    sourceLayer: string;
    sourceReferenceId: string | null;
    payload: Record<string, unknown>;
    confidenceBand: string | null;
  }>;
};
