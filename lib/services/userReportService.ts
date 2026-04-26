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
 * User-safe report: sections with visibility `user` or `shared` only.
 */
export async function getUserReportPayload(
  dossierId: string,
): Promise<{ ok: true; report: ReportPayloadView } | { ok: false; error: StructuredError }> {
  const row = await getRecommendationDossierById(dossierId);
  if (!row) return { ok: false, error: validationError("NOT_FOUND", "dossier not found") };

  const allowed = new Set(["user", "shared"]);
  const sections = row.reportSections
    .filter((s) => allowed.has(s.visibilityScope))
    .map((s) => ({
      sectionKey: s.sectionKey,
      sectionOrder: s.sectionOrder,
      sectionTitle: s.sectionTitle,
      sectionType: s.sectionType,
      visibilityScope: s.visibilityScope,
      payload: parseSectionPayload(s.sectionPayloadJson),
      explanationRefs: s.explanationRefsJson ? JSON.parse(s.explanationRefsJson) : null,
    }));

  const explanations = row.reportExplanations
    .filter((e) => sections.some((s) => s.sectionKey === e.relatedSectionKey))
    .map((e) => ({
      relatedSectionKey: e.relatedSectionKey,
      explanationType: e.explanationType,
      sourceLayer: e.sourceLayer,
      sourceReferenceId: e.sourceReferenceId,
      payload: parseSectionPayload(e.explanationPayloadJson),
      confidenceBand: e.confidenceBand,
    }));

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
  };
}
