import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import { getRecommendationDossierById } from "@/lib/services/recommendationDossierService";

import { sendStructuredError } from "./_utils";

function parseJson(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Internal/admin full dossier: all sections, summaries, and child rows (for QA and PDF pipeline design).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const id = typeof req.query.dossierId === "string" ? req.query.dossierId : null;
  if (!id) {
    return sendStructuredError(res, { code: "INVALID_QUERY", message: "dossierId required" }, 400);
  }

  const row = await getRecommendationDossierById(id);
  if (!row) {
    return sendStructuredError(res, { code: "NOT_FOUND", message: "dossier not found" }, 404);
  }

  return res.status(200).json({
    preview: true,
    dossier: {
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      recommendationSessionId: row.recommendationSessionId,
      candidateSnapshotIds: parseJson(row.candidateSnapshotIdsJson),
      selectedCandidateSnapshotId: row.selectedCandidateSnapshotId,
      generatedAt: row.generatedAt.toISOString(),
      dossierType: row.dossierType,
      dossierVersion: row.dossierVersion,
      projectContext: parseJson(row.projectContextSnapshotJson),
      recommendationSummary: parseJson(row.recommendationSummaryJson),
      pricingSummary: parseJson(row.pricingSummaryJson),
      supplySummary: parseJson(row.supplySummaryJson),
      personalizationSummary: parseJson(row.personalizationSummaryJson),
      geospatialSummary: parseJson(row.geospatialSummaryJson),
      feasibilitySummary: parseJson(row.feasibilitySummaryJson),
      scenarioSummary: parseJson(row.scenarioSummaryJson),
      installerReadinessSummary: parseJson(row.installerReadinessSummaryJson),
      executionNotes: parseJson(row.executionNotesJson),
      explanationProvenance: parseJson(row.explanationProvenanceJson),
      metadata: parseJson(row.metadataJson),
    },
    sections: row.reportSections.map((s) => ({
      ...s,
      sectionPayload: parseJson(s.sectionPayloadJson),
      explanationRefs: parseJson(s.explanationRefsJson),
    })),
    explanations: row.reportExplanations.map((e) => ({
      ...e,
      explanationPayload: parseJson(e.explanationPayloadJson),
    })),
    installerExecutionSummary: row.installerExecutionSummary
      ? {
          ...row.installerExecutionSummary,
          executionPayload: parseJson(row.installerExecutionSummary.executionPayloadJson),
          readinessChecklist: parseJson(row.installerExecutionSummary.readinessChecklistJson),
        }
      : null,
    adminReviewDossier: row.adminReviewDossier
      ? {
          ...row.adminReviewDossier,
          reviewPayload: parseJson(row.adminReviewDossier.reviewPayloadJson),
          riskAssessment: parseJson(row.adminReviewDossier.riskAssessmentJson),
          provenanceAudit: parseJson(row.adminReviewDossier.provenanceAuditJson),
        }
      : null,
  });
}
