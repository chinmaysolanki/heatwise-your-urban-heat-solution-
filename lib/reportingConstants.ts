export const DOSSIER_TYPES = [
  "user_final_recommendation",
  "installer_execution_summary",
  "admin_internal_review",
  "scenario_comparison_pack",
] as const;

export type DossierType = (typeof DOSSIER_TYPES)[number];

export const SECTION_KEYS = [
  "project_summary",
  "space_analysis",
  "recommendation_overview",
  "candidate_breakdown",
  "cost_summary",
  "maintenance_summary",
  "cooling_impact_summary",
  "supply_constraints_summary",
  "personalization_summary",
  "geospatial_summary",
  "phased_plan_summary",
  "installer_execution_notes",
  "admin_risk_review",
  "evidence_and_confidence",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const VISIBILITY_SCOPES = ["user", "installer", "admin", "shared"] as const;
export type VisibilityScope = (typeof VISIBILITY_SCOPES)[number];

export const SOURCE_LAYERS = [
  "rules",
  "ml_model",
  "pricing",
  "supply_intelligence",
  "personalization",
  "geospatial",
  "installer_ops",
  "verified_outcomes",
  "scenario_engine",
] as const;

export type SourceLayer = (typeof SOURCE_LAYERS)[number];

export const CONFIDENCE_BANDS = ["low", "medium", "high"] as const;

export type SectionBlueprint = {
  key: SectionKey;
  title: string;
  sectionType: string;
  visibility: VisibilityScope;
  order: number;
};

/** Deterministic section order and visibility by dossier type. */
export const DOSSIER_SECTION_BLUEPRINTS: Record<DossierType, SectionBlueprint[]> = {
  user_final_recommendation: [
    { key: "project_summary", title: "Project summary", sectionType: "structured", visibility: "user", order: 0 },
    { key: "space_analysis", title: "Space & environment", sectionType: "structured", visibility: "user", order: 1 },
    {
      key: "recommendation_overview",
      title: "Recommendation overview",
      sectionType: "structured",
      visibility: "shared",
      order: 2,
    },
    { key: "candidate_breakdown", title: "Candidates", sectionType: "structured", visibility: "user", order: 3 },
    { key: "cost_summary", title: "Cost summary", sectionType: "structured", visibility: "user", order: 4 },
    { key: "maintenance_summary", title: "Maintenance", sectionType: "structured", visibility: "user", order: 5 },
    { key: "cooling_impact_summary", title: "Cooling impact", sectionType: "structured", visibility: "user", order: 6 },
    {
      key: "supply_constraints_summary",
      title: "Supply & season",
      sectionType: "structured",
      visibility: "shared",
      order: 7,
    },
    {
      key: "personalization_summary",
      title: "Preferences",
      sectionType: "structured",
      visibility: "user",
      order: 8,
    },
    {
      key: "geospatial_summary",
      title: "Site & climate context",
      sectionType: "structured",
      visibility: "user",
      order: 9,
    },
    { key: "phased_plan_summary", title: "Phasing options", sectionType: "structured", visibility: "user", order: 10 },
    {
      key: "evidence_and_confidence",
      title: "Evidence & confidence",
      sectionType: "structured",
      visibility: "shared",
      order: 11,
    },
  ],
  installer_execution_summary: [
    { key: "project_summary", title: "Project summary", sectionType: "structured", visibility: "shared", order: 0 },
    {
      key: "recommendation_overview",
      title: "Recommendation overview",
      sectionType: "structured",
      visibility: "shared",
      order: 1,
    },
    { key: "candidate_breakdown", title: "Selected / shortlist", sectionType: "structured", visibility: "installer", order: 2 },
    {
      key: "installer_execution_notes",
      title: "Execution notes",
      sectionType: "structured",
      visibility: "installer",
      order: 3,
    },
    {
      key: "supply_constraints_summary",
      title: "Supply & logistics",
      sectionType: "structured",
      visibility: "installer",
      order: 4,
    },
    { key: "maintenance_summary", title: "Maintenance expectations", sectionType: "structured", visibility: "installer", order: 5 },
    {
      key: "evidence_and_confidence",
      title: "Evidence & confidence",
      sectionType: "structured",
      visibility: "shared",
      order: 6,
    },
  ],
  admin_internal_review: [
    { key: "project_summary", title: "Project summary", sectionType: "structured", visibility: "admin", order: 0 },
    { key: "space_analysis", title: "Space & environment", sectionType: "structured", visibility: "admin", order: 1 },
    {
      key: "recommendation_overview",
      title: "Recommendation overview",
      sectionType: "structured",
      visibility: "admin",
      order: 2,
    },
    { key: "candidate_breakdown", title: "Candidates", sectionType: "structured", visibility: "admin", order: 3 },
    { key: "cost_summary", title: "Cost summary", sectionType: "structured", visibility: "admin", order: 4 },
    { key: "maintenance_summary", title: "Maintenance", sectionType: "structured", visibility: "admin", order: 5 },
    { key: "cooling_impact_summary", title: "Cooling impact", sectionType: "structured", visibility: "admin", order: 6 },
    {
      key: "supply_constraints_summary",
      title: "Supply constraints",
      sectionType: "structured",
      visibility: "admin",
      order: 7,
    },
    {
      key: "personalization_summary",
      title: "Personalization",
      sectionType: "structured",
      visibility: "admin",
      order: 8,
    },
    { key: "geospatial_summary", title: "Geospatial", sectionType: "structured", visibility: "admin", order: 9 },
    { key: "phased_plan_summary", title: "Phasing / scenarios", sectionType: "structured", visibility: "admin", order: 10 },
    {
      key: "installer_execution_notes",
      title: "Installer notes",
      sectionType: "structured",
      visibility: "admin",
      order: 11,
    },
    { key: "admin_risk_review", title: "Risk review", sectionType: "structured", visibility: "admin", order: 12 },
    {
      key: "evidence_and_confidence",
      title: "Evidence & provenance",
      sectionType: "structured",
      visibility: "admin",
      order: 13,
    },
  ],
  scenario_comparison_pack: [
    { key: "project_summary", title: "Project summary", sectionType: "structured", visibility: "user", order: 0 },
    {
      key: "recommendation_overview",
      title: "Scenario pack overview",
      sectionType: "structured",
      visibility: "shared",
      order: 1,
    },
    { key: "candidate_breakdown", title: "Option comparison", sectionType: "structured", visibility: "user", order: 2 },
    { key: "cost_summary", title: "Cost tradeoffs", sectionType: "structured", visibility: "user", order: 3 },
    { key: "phased_plan_summary", title: "Phased plans", sectionType: "structured", visibility: "user", order: 4 },
    {
      key: "supply_constraints_summary",
      title: "Constraints by option",
      sectionType: "structured",
      visibility: "shared",
      order: 5,
    },
    {
      key: "evidence_and_confidence",
      title: "Evidence & confidence",
      sectionType: "structured",
      visibility: "shared",
      order: 6,
    },
  ],
};
