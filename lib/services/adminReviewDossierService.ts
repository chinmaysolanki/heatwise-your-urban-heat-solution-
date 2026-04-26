import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import type { ReportPayloadView } from "@/lib/reportingTypes";
import { getRecommendationDossierById } from "@/lib/services/recommendationDossierService";

function parseSectionPayload(raw: string): Record<string, unknown> {
  try {
    const x = JSON.parse(raw) as unknown;
    return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Admin review: all sections and explanations + AdminReviewDossier slice.
 */
export async function getAdminReviewPayload(
  dossierId: string,
): Promise<
  | {
      ok: true;
      report: ReportPayloadView;
      adminReview: {
        review: Record<string, unknown>;
        risk: Record<string, unknown> | null;
        provenance_audit: unknown;
      } | null;
    }
  | { ok: false; error: StructuredError }
> {
  const row = await getRecommendationDossierById(dossierId);
  if (!row) return { ok: false, error: validationError("NOT_FOUND", "dossier not found") };

  const sections = row.reportSections.map((s) => ({
    sectionKey: s.sectionKey,
    sectionOrder: s.sectionOrder,
    sectionTitle: s.sectionTitle,
    sectionType: s.sectionType,
    visibilityScope: s.visibilityScope,
    payload: parseSectionPayload(s.sectionPayloadJson),
    explanationRefs: s.explanationRefsJson ? JSON.parse(s.explanationRefsJson) : null,
  }));

  const explanations = row.reportExplanations.map((e) => ({
    relatedSectionKey: e.relatedSectionKey,
    explanationType: e.explanationType,
    sourceLayer: e.sourceLayer,
    sourceReferenceId: e.sourceReferenceId,
    payload: parseSectionPayload(e.explanationPayloadJson),
    confidenceBand: e.confidenceBand,
  }));

  const ar = row.adminReviewDossier;
  const adminReview = ar
    ? {
        review: parseSectionPayload(ar.reviewPayloadJson),
        risk: ar.riskAssessmentJson ? parseSectionPayload(ar.riskAssessmentJson) : null,
        provenance_audit: ar.provenanceAuditJson ? JSON.parse(ar.provenanceAuditJson) : null,
      }
    : null;

  return {
    ok: true,
    report: {
      dossier: {
        id: row.id,
        dossierType: row.dossierType,
        dossierVersion: row.dossierVersion,
        generatedAt: row.generatedAt.toISOString(),
        projectId: row.projectId,
        recommendationSessionId: row.recommendationSessionId,
        selectedCandidateSnapshotId: row.selectedCandidateSnapshotId,
        candidateSnapshotIds: JSON.parse(row.candidateSnapshotIdsJson) as string[],
      },
      sections,
      explanations,
    },
    adminReview,
  };
}
