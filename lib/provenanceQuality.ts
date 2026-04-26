import type { DossierType } from "@/lib/reportingConstants";

export type ProvenanceGap = {
  code: string;
  /** `unexpected_absent` — should be investigated for this dossier type. `optional_absent` — normal in many flows. */
  kind: "optional_absent" | "unexpected_absent";
  layer: "geospatial" | "supply_intelligence" | "pricing";
  message: string;
};

export type ProvenanceQualityAssessment = {
  overall: "ok" | "degraded";
  gaps: ProvenanceGap[];
  dossierType: DossierType;
  /** High-signal booleans for dashboards / logs */
  flags: {
    hasGeoSnapshot: boolean;
    hasConstraintSnapshot: boolean;
    costEstimateCount: number;
  };
};

/**
 * Classifies missing geo/supply/pricing linkage when assembling dossiers/reports.
 * Does **not** fail assembly — callers embed this in `explanationProvenanceJson` for debuggability.
 */
export function assessDossierProvenanceQuality(input: {
  dossierType: DossierType;
  hasGeoSnapshot: boolean;
  hasConstraintSnapshot: boolean;
  costEstimateCount: number;
}): ProvenanceQualityAssessment {
  const gaps: ProvenanceGap[] = [];
  const admin = input.dossierType === "admin_internal_review";
  const scenarioPack = input.dossierType === "scenario_comparison_pack";

  if (!input.hasGeoSnapshot) {
    gaps.push({
      code: "geo_snapshot_missing",
      kind: admin || scenarioPack ? "unexpected_absent" : "optional_absent",
      layer: "geospatial",
      message:
        admin || scenarioPack
          ? "Expected geospatial enrichment snapshot for this dossier type but none was linked."
          : "Geo snapshot absent (common when geo enrichment was skipped or not persisted).",
    });
  }

  if (!input.hasConstraintSnapshot) {
    gaps.push({
      code: "supply_constraint_snapshot_missing",
      kind: admin || scenarioPack ? "unexpected_absent" : "optional_absent",
      layer: "supply_intelligence",
      message:
        admin || scenarioPack
          ? "Expected supply constraint snapshot for this dossier type but none was linked."
          : "Supply constraint snapshot absent (skipped enrichment or empty regional DB).",
    });
  }

  if (input.costEstimateCount === 0) {
    gaps.push({
      code: "pricing_snapshot_missing",
      kind: "optional_absent",
      layer: "pricing",
      message: "No cost estimate snapshots on recommendation session — pricing provenance is thin.",
    });
  }

  const unexpected = gaps.filter((g) => g.kind === "unexpected_absent");
  return {
    overall: unexpected.length ? "degraded" : "ok",
    gaps,
    dossierType: input.dossierType,
    flags: {
      hasGeoSnapshot: input.hasGeoSnapshot,
      hasConstraintSnapshot: input.hasConstraintSnapshot,
      costEstimateCount: input.costEstimateCount,
    },
  };
}
