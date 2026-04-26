/**
 * Scenario is **not** a separate orchestration engine — it is a structured summary contract
 * persisted on dossiers (`scenarioSummaryJson`) and surfaced in phased-plan sections.
 */
export const SCENARIO_SUMMARY_SCHEMA_VERSION = "hw_scenario_summary_v1";

export type ScenarioSummaryV1 = {
  schema_version: typeof SCENARIO_SUMMARY_SCHEMA_VERSION;
  kind: "dossier_phased_plan_context";
  /** Where phased plan data was sourced */
  phased_plan_sources: "cost_estimate_snapshots" | "overrides_only";
  estimate_ids: string[];
  /** Optional human/product labels — safe to extend without migrations */
  labels?: Record<string, string>;
};

export function buildDefaultScenarioSummaryForDossier(costEstimateIds: string[]): ScenarioSummaryV1 {
  return {
    schema_version: SCENARIO_SUMMARY_SCHEMA_VERSION,
    kind: "dossier_phased_plan_context",
    phased_plan_sources: costEstimateIds.length ? "cost_estimate_snapshots" : "overrides_only",
    estimate_ids: costEstimateIds,
  };
}
