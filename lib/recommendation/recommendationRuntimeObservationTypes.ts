import type {
  RolloutGuardrailAlert,
  RolloutGuardrailInputs,
  RolloutGuardrailThresholds,
} from "@/lib/recommendation/recommendationRolloutGuardrails";

export type RolloutGuardrailBundle = {
  sample_size: number;
  thresholds: RolloutGuardrailThresholds;
  alerts: RolloutGuardrailAlert[];
  inputs: RolloutGuardrailInputs;
};

export type RecommendationRuntimeObservabilityPayload = {
  window: { start: string; end: string };
  total_observations: number;
  /** Success-only rows (observationKind === success); used for path/guardrail denominators. */
  success_observation_count: number;
  traffic_channel_counts: Record<string, number>;
  observation_kind_counts: Record<string, number>;
  runtime_path_counts: Record<string, number>;
  runtime_path_share: Record<string, number | null>;
  generator_source_counts: Record<string, number>;
  fallback_reason_counts: Record<string, number>;
  layout_slate_counts: Record<string, number>;
  aggregates: {
    empty_candidate_responses: number;
    mean_ml_species_code_coverage: number | null;
    mean_layout_unresolved_identity_per_observation: number | null;
    layout_attached: number;
    layout_failed: number;
    layout_skipped_ineligible: number;
    /** Share of observations that are handler/client errors (all traffic). */
    handler_error_share: number | null;
    client_error_share: number | null;
  };
  /** Primary guardrails: successful generates only (avoids failure rows skewing path mix). */
  guardrails: RolloutGuardrailBundle;
  /** Narrower: canonical traffic + success only (reduces shadow/compat distortion). */
  guardrails_canonical_success: RolloutGuardrailBundle;
};
