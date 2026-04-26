/**
 * Types for experiment assignment, shadow evaluation, and rollout APIs.
 */

export type EvaluationMode = "live" | "shadow" | "disabled";

export type RecommendationVariant = "rules_only" | "hybrid_v1" | "ml_heavy_v1" | "shadow_only";

export type ExperimentStatus = "draft" | "active" | "paused" | "completed" | "archived";

export type ExperimentRecord = {
  experiment_id: string;
  experiment_name: string;
  status: ExperimentStatus;
  description?: string;
  created_at?: string;
  primary_variant: RecommendationVariant | string;
  control_variant?: string;
  treatment_variants?: string[];
  allocation_policy: string;
  traffic_allocation: Record<string, number>;
  target_population_filters?: {
    project_types?: string[];
    climate_zones?: string[];
    city_tiers?: string[];
    internal_only?: boolean;
    allow_user_ids?: string[];
    deny_user_ids?: string[];
  };
  start_at?: string | null;
  end_at?: string | null;
  success_metrics?: string[];
  guardrail_metrics?: string[];
  shadow_config?: {
    enabled?: boolean;
    shadow_variant?: string;
    primary_is_user_visible?: boolean;
  };
  notes?: string;
};

export type ExperimentsFile = {
  experiments: ExperimentRecord[];
};

export type AssignmentPayload = {
  experiment_id: string | null;
  primary_variant?: string;
  shadow_variant?: string | null;
  allocation_policy?: string;
  assigned_variant: string;
  served_variant: string;
  assignment_reason: string;
  bucket_id: number;
  evaluation_mode: EvaluationMode;
};

export type EvaluationContextInput = {
  assignmentKey?: string;
  experimentId?: string | null;
  projectType?: string | null;
  climateZone?: string | null;
  cityTier?: string | null;
  internalUser?: boolean;
};

export type RequestLevelEvaluationSummary = {
  experiment_id: string | null;
  assigned_variant: string | null;
  served_variant: string | null;
  exact_top1_match: boolean;
  top3_overlap_count: number;
  average_rank_shift: number;
  expected_temp_reduction_delta: number | null;
  expected_install_cost_delta: number | null;
  feasibility_delta: number | null;
  safety_delta: number | null;
  filtered_candidate_count_delta: number;
  latency_delta_ms: number | null;
  rules_version_primary?: string;
  rules_version_shadow?: string;
  shadow_compute_failed?: boolean;
};

export type RolloutStateFile = {
  active_experiment_id: string | null;
  current_phase: string;
  last_gate_outcome: string;
  last_evaluated_at: string | null;
  traffic_percent_for_treatment: number;
  notes?: string;
};
