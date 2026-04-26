import { db } from "@/lib/db";
import { assessDossierProvenanceQuality } from "@/lib/provenanceQuality";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";
import { buildDefaultScenarioSummaryForDossier } from "@/lib/scenarioSummaryContract";

import {
  DOSSIER_SECTION_BLUEPRINTS,
  DOSSIER_TYPES,
  type DossierType,
  type SectionKey,
} from "@/lib/reportingConstants";
import type { AssembleRecommendationDossierInput } from "@/lib/reportingTypes";
import {
  buildDefaultExplanationsForSection,
  buildExplanationProvenanceJson,
} from "@/lib/services/reportExplanationService";

function parseJson<T extends Record<string, unknown>>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isDossierType(x: string): x is DossierType {
  return (DOSSIER_TYPES as readonly string[]).includes(x);
}

function pickPayloadSummary(payload: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    "recommendation_type",
    "species_primary",
    "greenery_density",
    "planter_type",
    "irrigation_type",
    "shade_solution",
    "cooling_strategy",
    "candidate_id",
  ];
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in payload) out[k] = payload[k];
  }
  return out;
}

function buildSectionPayload(
  key: SectionKey,
  ctx: {
    project: Record<string, unknown>;
    environment: Record<string, unknown>;
    preferences: Record<string, unknown>;
    session: { id: string; rulesVersion: string; modelVersion: string; generatorSource: string; totalCandidates: number };
    candidates: Array<{
      id: string;
      candidateRank: number;
      candidatePayloadJson: string;
      estimatedInstallCostInr: number | null;
      estimatedMaintenanceCostInr: number | null;
      feasibilityScore: number | null;
      heatMitigationScore: number | null;
      expectedTempReductionC: number | null;
      expectedSurfaceTempReductionC: number | null;
    }>;
    selectedId: string | null;
    constraint: Record<string, unknown> | null;
    geo: Record<string, unknown> | null;
    costs: Array<Record<string, unknown>>;
    budgetFits: Array<Record<string, unknown>>;
    overrides: AssembleRecommendationDossierInput["overrides"];
  },
): Record<string, unknown> {
  switch (key) {
    case "project_summary":
      return {
        name: ctx.project.name,
        location: ctx.project.location,
        area: ctx.project.area,
        primary_goal: ctx.project.primaryGoal,
        surface_type: ctx.project.surfaceType,
        status: ctx.project.status,
      };
    case "space_analysis":
      return {
        sunlight_hours: ctx.environment.sunlight_hours ?? ctx.environment.sunlightHours,
        shade_level: ctx.environment.shade_level ?? ctx.environment.shadeLevel,
        drainage: ctx.environment.drainage_quality ?? ctx.environment.drainage,
        water_availability: ctx.environment.water_availability ?? ctx.environment.waterAvailability,
        region: ctx.environment.region,
        climate_zone: ctx.environment.climate_zone ?? ctx.environment.climateZone,
      };
    case "recommendation_overview":
      return {
        recommendation_session_id: ctx.session.id,
        rules_version: ctx.session.rulesVersion,
        model_version: ctx.session.modelVersion,
        generator_source: ctx.session.generatorSource,
        total_candidates: ctx.session.totalCandidates,
        selected_candidate_snapshot_id: ctx.selectedId,
      };
    case "candidate_breakdown":
      return {
        items: ctx.candidates.map((c) => {
          const p = parseJson<Record<string, unknown>>(c.candidatePayloadJson) ?? {};
          return {
            candidate_snapshot_id: c.id,
            rank: c.candidateRank,
            payload_summary: pickPayloadSummary(p),
            estimated_install_inr: c.estimatedInstallCostInr,
            estimated_maintenance_inr: c.estimatedMaintenanceCostInr,
            feasibility_score: c.feasibilityScore,
            heat_mitigation_score: c.heatMitigationScore,
            expected_temp_reduction_c: c.expectedTempReductionC,
            expected_surface_temp_reduction_c: c.expectedSurfaceTempReductionC,
          };
        }),
      };
    case "cost_summary": {
      const fromSnaps = ctx.costs.map((c) => ({
        estimate_id: c.id,
        median_install_inr: c.estimatedInstallCostMedianInr,
        median_maintenance_inr: c.estimatedAnnualMaintenanceMedianInr,
        confidence_band: c.estimateConfidenceBand,
        candidate_snapshot_id: c.candidateSnapshotId,
      }));
      return { cost_estimate_snapshots: fromSnaps, count: fromSnaps.length };
    }
    case "maintenance_summary":
      return {
        annual_maintenance_by_candidate: ctx.candidates.map((c) => ({
          candidate_snapshot_id: c.id,
          estimated_maintenance_inr: c.estimatedMaintenanceCostInr,
        })),
      };
    case "cooling_impact_summary":
      return {
        by_candidate: ctx.candidates.map((c) => ({
          candidate_snapshot_id: c.id,
          expected_temp_reduction_c: c.expectedTempReductionC,
          expected_surface_temp_reduction_c: c.expectedSurfaceTempReductionC,
          heat_mitigation_score: c.heatMitigationScore,
        })),
      };
    case "supply_constraints_summary":
      return ctx.constraint
        ? { constraint_snapshot: ctx.constraint }
        : { constraint_snapshot: null, note: "no_snapshot_linked" };
    case "personalization_summary":
      return { preferences: ctx.preferences, ...(ctx.overrides?.personalizationSummary ?? {}) };
    case "geospatial_summary":
      return ctx.geo ? { geo_enrichment: ctx.geo } : { geo_enrichment: null };
    case "phased_plan_summary":
      return {
        phased_options_from_estimates: ctx.costs.map((c) => ({
          estimate_id: c.id,
          phased_install_option: c.phasedInstallOptionJson ? parseJson(String(c.phasedInstallOptionJson)) : null,
        })),
        ...(ctx.overrides?.scenarioSummary ?? {}),
      };
    case "installer_execution_notes":
      return {
        readiness: ctx.overrides?.installerReadiness ?? {},
        notes: ctx.overrides?.executionNotes ?? {},
        selected_candidate_snapshot_id: ctx.selectedId,
      };
    case "admin_risk_review":
      return {
        budget_fit_records: ctx.budgetFits,
        feasibility_tail: ctx.candidates.map((c) => ({
          id: c.id,
          feasibility_score: c.feasibilityScore,
        })),
      };
    case "evidence_and_confidence":
      return {
        rules_version: ctx.session.rulesVersion,
        model_version: ctx.session.modelVersion,
        candidate_count: ctx.candidates.length,
        has_supply_snapshot: Boolean(ctx.constraint),
        has_geo_snapshot: Boolean(ctx.geo),
      };
    default:
      return { note: "empty_section", key };
  }
}

/**
 * Assembles a recommendation dossier + sections + explanations from telemetry and linked intelligence rows.
 */
export async function assembleAndPersistRecommendationDossier(
  input: AssembleRecommendationDossierInput,
): Promise<{ ok: true; recommendationDossierId: string } | { ok: false; error: StructuredError }> {
  if (!isDossierType(input.dossierType)) {
    return { ok: false, error: validationError("INVALID_DOSSIER_TYPE", "unknown dossier_type") };
  }

  const session = await db.recommendationTelemetrySession.findUnique({
    where: { id: input.recommendationSessionId },
    include: {
      candidateSnapshots: { orderBy: { candidateRank: "asc" } },
    },
  });

  if (!session) {
    return { ok: false, error: validationError("NOT_FOUND", "recommendation session not found") };
  }

  const candidateIds = session.candidateSnapshots.map((c) => c.id);
  if (input.selectedCandidateSnapshotId && !candidateIds.includes(input.selectedCandidateSnapshotId)) {
    return {
      ok: false,
      error: validationError("INVALID_SELECTION", "selected_candidate_snapshot_id not in session candidates"),
    };
  }

  const project = parseJson<Record<string, unknown>>(session.projectSnapshotJson) ?? {};
  const environment = parseJson<Record<string, unknown>>(session.environmentSnapshotJson) ?? {};
  const preferences = parseJson<Record<string, unknown>>(session.preferenceSnapshotJson) ?? {};

  const [geoSnap, constraintSnap, costs, budgetFits] = await Promise.all([
    db.geoEnrichmentSnapshot.findFirst({
      where: { projectId: session.projectId, recommendationSessionId: session.id },
      orderBy: { enrichmentCreatedAt: "desc" },
    }),
    db.recommendationConstraintSnapshot.findFirst({
      where: { recommendationSessionId: session.id },
      orderBy: { generatedAt: "desc" },
    }),
    db.costEstimateSnapshot.findMany({
      where: { recommendationSessionId: session.id },
      orderBy: { estimateGeneratedAt: "desc" },
    }),
    db.budgetFitAssessment.findMany({
      where: {
        projectId: session.projectId,
        candidateSnapshotId: { in: candidateIds },
      },
    }),
  ]);

  const dossierVersion = input.dossierVersion ?? "1.0.0";
  const blueprint = DOSSIER_SECTION_BLUEPRINTS[input.dossierType];

  const ctx = {
    project,
    environment,
    preferences,
    session: {
      id: session.id,
      rulesVersion: session.rulesVersion,
      modelVersion: session.modelVersion,
      generatorSource: session.generatorSource,
      totalCandidates: session.totalCandidates,
    },
    candidates: session.candidateSnapshots,
    selectedId: input.selectedCandidateSnapshotId ?? null,
    constraint: constraintSnap
      ? {
          id: constraintSnap.id,
          region: constraintSnap.region,
          climate_zone: constraintSnap.climateZone,
          month_of_year: constraintSnap.monthOfYear,
          supply_readiness_score: constraintSnap.supplyReadinessScore,
          seasonal_readiness_score: constraintSnap.seasonalReadinessScore,
          constraint_flags: parseJson(constraintSnap.constraintFlagsJson),
        }
      : null,
    geo: geoSnap
      ? {
          id: geoSnap.id,
          overall_geo_confidence: geoSnap.overallGeoConfidence,
          geo_context_id: geoSnap.geoContextId,
          microclimate_id: geoSnap.microclimateSnapshotId,
          site_exposure_id: geoSnap.siteExposureId,
        }
      : null,
    costs: costs.map((c) => ({ ...c }) as unknown as Record<string, unknown>),
    budgetFits: budgetFits.map((b) => ({ ...b }) as unknown as Record<string, unknown>),
    overrides: input.overrides,
  };

  const recommendationSummaryJson = JSON.stringify({
    session_id: session.id,
    candidate_snapshot_ids: candidateIds,
    rules_version: session.rulesVersion,
    model_version: session.modelVersion,
    total_candidates: session.totalCandidates,
    latency_ms: session.latencyMs,
  });

  const pricingSummaryJson = JSON.stringify({
    cost_estimate_count: costs.length,
    by_candidate: session.candidateSnapshots.map((c) => ({
      candidate_snapshot_id: c.id,
      estimated_install_inr: c.estimatedInstallCostInr,
      estimated_maintenance_inr: c.estimatedMaintenanceCostInr,
    })),
  });

  const supplySummaryJson = ctx.constraint ? JSON.stringify(ctx.constraint) : null;
  const personalizationSummaryJson = JSON.stringify({
    ...preferences,
    ...(input.overrides?.personalizationSummary ?? {}),
  });
  const geospatialSummaryJson = ctx.geo ? JSON.stringify(ctx.geo) : null;
  const feasibilitySummaryJson = JSON.stringify({
    by_candidate: session.candidateSnapshots.map((c) => ({
      id: c.id,
      feasibility_score: c.feasibilityScore,
      safety_score: c.safetyScore,
    })),
    ...(input.overrides?.feasibilitySummary ?? {}),
  });
  const scenarioSummaryJson = input.overrides?.scenarioSummary
    ? JSON.stringify(input.overrides.scenarioSummary)
    : JSON.stringify(buildDefaultScenarioSummaryForDossier(costs.map((c) => c.id)));

  const installerReadinessSummaryJson = JSON.stringify({
    supply_readiness: constraintSnap?.supplyReadinessScore ?? null,
    seasonal_readiness: constraintSnap?.seasonalReadinessScore ?? null,
    ...(input.overrides?.installerReadiness ?? {}),
  });

  const executionNotesJson = input.overrides?.executionNotes
    ? JSON.stringify(input.overrides.executionNotes)
    : null;

  const quality = assessDossierProvenanceQuality({
    dossierType: input.dossierType,
    hasGeoSnapshot: Boolean(geoSnap),
    hasConstraintSnapshot: Boolean(constraintSnap),
    costEstimateCount: costs.length,
  });
  if (quality.overall === "degraded") {
    console.warn(
      `[heatwise dossier] provenance degraded dossierType=${input.dossierType} session=${session.id}`,
      quality.gaps.filter((g) => g.kind === "unexpected_absent").map((g) => g.code),
    );
  }

  const explanationProvenanceJson = buildExplanationProvenanceJson({
    recommendationSessionId: session.id,
    rulesVersion: session.rulesVersion,
    modelVersion: session.modelVersion,
    dossierVersion,
    geoEnrichmentSnapshotId: geoSnap?.id ?? null,
    constraintSnapshotId: constraintSnap?.id ?? null,
    provenanceQuality: {
      overall: quality.overall,
      gaps: quality.gaps,
      dossierType: quality.dossierType,
      flags: quality.flags,
    },
  });

  const pricingEstimateIds = costs.map((c) => c.id);

  const result = await db.$transaction(async (tx) => {
    const dossier = await tx.recommendationDossier.create({
      data: {
        projectId: session.projectId,
        userId: input.userId ?? session.userId ?? undefined,
        recommendationSessionId: session.id,
        candidateSnapshotIdsJson: JSON.stringify(candidateIds),
        selectedCandidateSnapshotId: input.selectedCandidateSnapshotId ?? undefined,
        dossierType: input.dossierType,
        dossierVersion,
        projectContextSnapshotJson: JSON.stringify({ project, environment, preferences }),
        recommendationSummaryJson,
        pricingSummaryJson,
        supplySummaryJson,
        personalizationSummaryJson,
        geospatialSummaryJson,
        feasibilitySummaryJson,
        scenarioSummaryJson,
        installerReadinessSummaryJson,
        executionNotesJson: executionNotesJson ?? undefined,
        explanationProvenanceJson,
      },
    });

    for (const bp of blueprint) {
      const payload = buildSectionPayload(bp.key, ctx);
      await tx.reportSection.create({
        data: {
          recommendationDossierId: dossier.id,
          sectionKey: bp.key,
          sectionOrder: bp.order,
          sectionTitle: bp.title,
          sectionType: bp.sectionType,
          sectionPayloadJson: JSON.stringify(payload),
          visibilityScope: bp.visibility,
        },
      });
    }

    const explanationRows: Array<{
      recommendationDossierId: string;
      relatedSectionKey: string;
      explanationType: string;
      sourceLayer: string;
      sourceReferenceId: string | null;
      explanationPayloadJson: string;
      confidenceBand: string | null;
    }> = [];

    for (const bp of blueprint) {
      const seeds = buildDefaultExplanationsForSection(bp.key, {
        recommendationSessionId: session.id,
        rulesVersion: session.rulesVersion,
        modelVersion: session.modelVersion,
        geoEnrichmentSnapshotId: geoSnap?.id ?? null,
        constraintSnapshotId: constraintSnap?.id ?? null,
        pricingEstimateIds,
      });
      for (const s of seeds) {
        explanationRows.push({
          recommendationDossierId: dossier.id,
          relatedSectionKey: s.relatedSectionKey,
          explanationType: s.explanationType,
          sourceLayer: s.sourceLayer,
          sourceReferenceId: s.sourceReferenceId ?? null,
          explanationPayloadJson: JSON.stringify(s.explanationPayload),
          confidenceBand: s.confidenceBand ?? null,
        });
      }
    }

    if (explanationRows.length) {
      await tx.reportExplanation.createMany({ data: explanationRows });
    }

    if (input.dossierType === "installer_execution_summary") {
      const primary =
        session.candidateSnapshots.find((c) => c.id === input.selectedCandidateSnapshotId) ??
        session.candidateSnapshots[0];
      await tx.installerExecutionSummary.create({
        data: {
          recommendationDossierId: dossier.id,
          projectId: session.projectId,
          executionPayloadJson: JSON.stringify({
            primary_candidate_snapshot_id: primary?.id ?? null,
            checklist_version: "hw-exec-v1",
            structural_flags: ctx.constraint ? ["review_constraint_flags"] : [],
          }),
          readinessChecklistJson: JSON.stringify([
            { id: "drainage", required: true },
            { id: "wind_exposure", required: true },
            { id: "irrigation_tap", required: false },
          ]),
        },
      });
    }

    if (input.dossierType === "admin_internal_review") {
      await tx.adminReviewDossier.create({
        data: {
          recommendationDossierId: dossier.id,
          reviewPayloadJson: JSON.stringify({
            review_status: "recorded",
            session_id: session.id,
            candidate_count: session.candidateSnapshots.length,
          }),
          riskAssessmentJson: JSON.stringify({
            budget_fit_count: budgetFits.length,
            high_affordability_risk: budgetFits.some((b) => b.affordabilityRiskLevel === "high"),
          }),
          provenanceAuditJson: explanationProvenanceJson,
        },
      });
    }

    return dossier.id;
  });

  return { ok: true, recommendationDossierId: result };
}

export async function getRecommendationDossierById(dossierId: string) {
  return db.recommendationDossier.findUnique({
    where: { id: dossierId },
    include: {
      reportSections: { orderBy: { sectionOrder: "asc" } },
      reportExplanations: true,
      installerExecutionSummary: true,
      adminReviewDossier: true,
    },
  });
}
