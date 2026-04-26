/**
 * Admin analytics API contracts — aligned with:
 * - `RecommendationTelemetryEvent.eventType` / `FEEDBACK_EVENT_TYPES`
 * - `RecommendationTelemetrySession` snapshots + versioning
 * - `InstallOutcomeRecord` outcome fields
 * - `ml/evaluation/data/*` rollout + experiment JSON (operational overlay)
 */

import type { RecommendationRuntimeObservabilityPayload } from "@/lib/recommendation/recommendationRuntimeObservationTypes";

export type AdminExportEnvelope<T> = {
  schema_version: "admin_metrics.v1";
  generated_at: string;
  export_ready: true;
  window?: { start: string; end: string };
  data: T;
};

export type FunnelStageKey =
  | "sessions_generated"
  | "impression"
  | "expand"
  | "save"
  | "select"
  | "installer_request"
  | "install_completed";

export type FunnelCounts = Record<FunnelStageKey, number>;

export type FunnelRates = {
  impression_rate: number | null;
  expand_rate: number | null;
  save_rate: number | null;
  select_rate: number | null;
  installer_request_rate: number | null;
  install_completion_rate: number | null;
};

export type RecommendationFunnelSummary = {
  unique_sessions: FunnelCounts;
  rates_vs_impression: FunnelRates;
  rates_vs_sessions: {
    impression_rate: number | null;
    expand_rate: number | null;
    save_rate: number | null;
    select_rate: number | null;
    installer_request_rate: number | null;
    install_completed_rate: number | null;
  };
  event_type_counts: Record<string, number>;
};

export type CohortSlice = {
  project_type: string;
  climate_zone: string;
  budget_band: string;
};

export type CohortMetricsRow = CohortSlice & {
  sessions: number;
  impressions: number;
  selects: number;
  installer_requests: number;
  installs_completed: number;
};

export type InstallerOutcomeSummary = {
  by_status: Record<string, number>;
  completed_count: number;
  avg_user_satisfaction: number | null;
  avg_installer_feasibility: number | null;
  avg_measured_temp_change_c: number | null;
  avg_plant_survival_30d: number | null;
  avg_plant_survival_90d: number | null;
};

export type InstallerOutcomeByCohortRow = CohortSlice & {
  outcome_count: number;
  completed_count: number;
  avg_user_satisfaction: number | null;
  avg_measured_temp_change_c: number | null;
};

export type ExperimentVariantMetrics = {
  variant_key: string;
  session_count: number;
  generator_source_mix: Record<string, number>;
  rules_version_mix: Record<string, number>;
  median_latency_ms: number | null;
  impression_count: number;
  select_count: number;
  installer_request_count: number;
};

export type ExperimentSummaryPayload = {
  by_variant: ExperimentVariantMetrics[];
  from_evaluation_files?: {
    runtime_evaluations_lines?: number;
    path?: string;
    notes?: string;
  };
};

export type RolloutMonitorPayload = {
  rollout_state: Record<string, unknown>;
          active_experiments_count: number;
          health_proxy: {
            telemetry_sessions_last_window: number;
            median_latency_ms: number | null;
            rules_only_session_share: number | null;
            hybrid_session_share: number | null;
          };
  /** Phase 8: per-request observations from POST /api/recommendations/generate. */
  recommendation_runtime?: RecommendationRuntimeObservabilityPayload;
};

export type MetricsOverviewPayload = {
  funnel: RecommendationFunnelSummary;
  outcomes: InstallerOutcomeSummary;
  sessions_in_window: number;
  events_in_window: number;
  /** Present when `include_cohorts=1` on metrics-overview. */
  cohort_funnel?: CohortMetricsRow[];
};
