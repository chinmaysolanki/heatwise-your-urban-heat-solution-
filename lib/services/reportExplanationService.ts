import type { SourceLayer } from "@/lib/reportingConstants";

export type ExplanationSeed = {
  relatedSectionKey: string;
  explanationType: string;
  sourceLayer: SourceLayer;
  sourceReferenceId?: string | null;
  explanationPayload: Record<string, unknown>;
  confidenceBand?: string | null;
};

/**
 * Structured provenance rows (no generative copy). One or more per section.
 */
export function buildDefaultExplanationsForSection(
  sectionKey: string,
  ctx: {
    recommendationSessionId: string;
    rulesVersion: string;
    modelVersion: string;
    geoEnrichmentSnapshotId?: string | null;
    constraintSnapshotId?: string | null;
    pricingEstimateIds?: string[];
  },
): ExplanationSeed[] {
  const basePayload = {
    section_key: sectionKey,
    session_id: ctx.recommendationSessionId,
    caveat: "structured_json_only",
  };

  const out: ExplanationSeed[] = [
    {
      relatedSectionKey: sectionKey,
      explanationType: "provenance_trace",
      sourceLayer: "rules",
      sourceReferenceId: ctx.recommendationSessionId,
      explanationPayload: { ...basePayload, rules_version: ctx.rulesVersion },
      confidenceBand: "high",
    },
    {
      relatedSectionKey: sectionKey,
      explanationType: "provenance_trace",
      sourceLayer: "ml_model",
      sourceReferenceId: ctx.modelVersion,
      explanationPayload: { ...basePayload, model_version: ctx.modelVersion },
      confidenceBand: "medium",
    },
  ];

  if (["cost_summary", "maintenance_summary", "candidate_breakdown"].includes(sectionKey)) {
    out.push({
      relatedSectionKey: sectionKey,
      explanationType: "provenance_trace",
      sourceLayer: "pricing",
      sourceReferenceId: ctx.pricingEstimateIds?.[0] ?? null,
      explanationPayload: { ...basePayload, estimate_ids: ctx.pricingEstimateIds ?? [] },
      confidenceBand: "medium",
    });
  }

  if (sectionKey === "supply_constraints_summary") {
    out.push({
      relatedSectionKey: sectionKey,
      explanationType: "provenance_trace",
      sourceLayer: "supply_intelligence",
      sourceReferenceId: ctx.constraintSnapshotId ?? null,
      explanationPayload: { ...basePayload },
      confidenceBand: "medium",
    });
  }

  if (sectionKey === "geospatial_summary") {
    out.push({
      relatedSectionKey: sectionKey,
      explanationType: "provenance_trace",
      sourceLayer: "geospatial",
      sourceReferenceId: ctx.geoEnrichmentSnapshotId ?? null,
      explanationPayload: { ...basePayload },
      confidenceBand: "medium",
    });
  }

  if (sectionKey === "personalization_summary") {
    out.push({
      relatedSectionKey: sectionKey,
      explanationType: "provenance_trace",
      sourceLayer: "personalization",
      sourceReferenceId: null,
      explanationPayload: { ...basePayload },
      confidenceBand: "medium",
    });
  }

  if (sectionKey === "admin_risk_review") {
    out.push({
      relatedSectionKey: sectionKey,
      explanationType: "provenance_trace",
      sourceLayer: "installer_ops",
      sourceReferenceId: null,
      explanationPayload: { ...basePayload, note: "admin_slice" },
      confidenceBand: "low",
    });
  }

  if (sectionKey === "phased_plan_summary") {
    out.push({
      relatedSectionKey: sectionKey,
      explanationType: "provenance_trace",
      sourceLayer: "scenario_engine",
      sourceReferenceId: null,
      explanationPayload: { ...basePayload },
      confidenceBand: "medium",
    });
  }

  return out;
}

export function buildExplanationProvenanceJson(ctx: {
  recommendationSessionId: string;
  rulesVersion: string;
  modelVersion: string;
  dossierVersion: string;
  geoEnrichmentSnapshotId?: string | null;
  constraintSnapshotId?: string | null;
  /** Optional quality assessment from `assessDossierProvenanceQuality` */
  provenanceQuality?: Record<string, unknown>;
}): string {
  return JSON.stringify({
    dossier_assembly_version: ctx.dossierVersion,
    captured_at: new Date().toISOString(),
    sources: [
      { layer: "rules", reference_id: ctx.recommendationSessionId, version: ctx.rulesVersion },
      { layer: "ml_model", reference_id: ctx.modelVersion, version: ctx.modelVersion },
      ...(ctx.geoEnrichmentSnapshotId
        ? [{ layer: "geospatial", reference_id: ctx.geoEnrichmentSnapshotId }]
        : []),
      ...(ctx.constraintSnapshotId
        ? [{ layer: "supply_intelligence", reference_id: ctx.constraintSnapshotId }]
        : []),
    ],
    caveats: ["no_llm_narrative", "renderers_may_map_sections_to_pdf_sections"],
    ...(ctx.provenanceQuality ? { provenance_quality: ctx.provenanceQuality } : {}),
  });
}
