import crypto from "crypto";
import fs from "fs";
import path from "path";

import type {
  AssignmentPayload,
  EvaluationContextInput,
  ExperimentRecord,
  ExperimentsFile,
} from "@/lib/ml/evaluationTypes";

function experimentsPath(): string {
  return process.env.HEATWISE_EXPERIMENTS_PATH ?? path.join(process.cwd(), "ml/evaluation/data/experiments.json");
}

function rulesOnlyRegistryDir(): string {
  return process.env.HEATWISE_RULES_ONLY_REGISTRY_DIR ?? path.join(process.cwd(), "ml/evaluation/data/empty_registry");
}

export function loadExperimentsFile(): ExperimentsFile {
  const p = experimentsPath();
  if (!fs.existsSync(p)) {
    return { experiments: [] };
  }
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw) as ExperimentsFile;
}

function stableHashInt(key: string, salt: string): number {
  const h = crypto.createHash("sha256").update(`${salt}|${key}`).digest("hex");
  return parseInt(h.slice(0, 12), 16);
}

function inFilters(
  context: Record<string, unknown>,
  filters: ExperimentRecord["target_population_filters"],
): { ok: boolean; reason: string } {
  if (!filters) return { ok: true, reason: "" };
  if (filters.internal_only && !context.internal_user) {
    return { ok: false, reason: "internal_only_experiment" };
  }
  const uid = String(context.user_id ?? "");
  if (uid && filters.deny_user_ids?.includes(uid)) {
    return { ok: false, reason: "user_denylisted" };
  }
  if (filters.allow_user_ids?.length) {
    if (!uid || !filters.allow_user_ids.includes(uid)) {
      return { ok: false, reason: "user_not_allowlisted" };
    }
  }
  const pt = String(context.project_type ?? "");
  if (filters.project_types?.length && pt && !filters.project_types.includes(pt)) {
    return { ok: false, reason: "project_type_filtered" };
  }
  const cz = String(context.climate_zone ?? "");
  if (filters.climate_zones?.length && cz && !filters.climate_zones.includes(cz)) {
    return { ok: false, reason: "climate_zone_filtered" };
  }
  const ct = String(context.city_tier ?? "");
  if (filters.city_tiers?.length && ct && !filters.city_tiers.includes(ct)) {
    return { ok: false, reason: "city_tier_filtered" };
  }
  return { ok: true, reason: "" };
}

export function pickVariantFromAllocation(
  experimentId: string,
  assignmentKey: string,
  trafficAllocation: Record<string, number>,
): { assigned: string; bucketId: number } {
  const entries = Object.entries(trafficAllocation);
  const variants = entries.map(([v]) => v);
  const weights = entries.map(([, w]) => Math.max(0, Number(w)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || variants.length === 0) {
    return { assigned: variants[0] ?? "rules_only", bucketId: -1 };
  }
  const h = stableHashInt(assignmentKey, experimentId) % 10_000;
  const bucketId = h % 100;
  const threshold = (h / 10_000) * total;
  let cumulative = 0;
  let assigned = variants[0];
  for (let i = 0; i < variants.length; i++) {
    cumulative += weights[i];
    if (threshold < cumulative) {
      assigned = variants[i];
      break;
    }
  }
  return { assigned, bucketId };
}

export function assignForExperiment(
  experiment: ExperimentRecord,
  assignmentKey: string,
  context: Record<string, unknown>,
): AssignmentPayload | null {
  if (experiment.status !== "active") {
    return null;
  }
  const ctrl = String(experiment.control_variant ?? "rules_only");
  const { ok, reason } = inFilters(context, experiment.target_population_filters);
  if (!ok) {
    return {
      experiment_id: experiment.experiment_id,
      primary_variant: experiment.primary_variant,
      shadow_variant: experiment.shadow_config?.shadow_variant ?? null,
      allocation_policy: experiment.allocation_policy,
      assigned_variant: ctrl,
      served_variant: ctrl,
      assignment_reason: `filtered_out:${reason}`,
      bucket_id: -1,
      evaluation_mode: "disabled",
    };
  }

  const { assigned, bucketId } = pickVariantFromAllocation(
    experiment.experiment_id,
    assignmentKey,
    experiment.traffic_allocation,
  );

  const shadowOn = Boolean(experiment.shadow_config?.enabled);
  const evaluation_mode = shadowOn ? "shadow" : "live";
  const served_variant = shadowOn ? ctrl : assigned;

  return {
    experiment_id: experiment.experiment_id,
    primary_variant: experiment.primary_variant,
    shadow_variant: experiment.shadow_config?.shadow_variant ?? null,
    allocation_policy: experiment.allocation_policy,
    assigned_variant: assigned,
    served_variant,
    assignment_reason: "deterministic_hash_bucket",
    bucket_id: bucketId,
    evaluation_mode,
  };
}

export function assignForRequest(input: {
  assignmentKey: string;
  experimentId?: string | null;
  userId?: string | null;
  projectId?: string | null;
  evaluationContext?: EvaluationContextInput | null;
}): AssignmentPayload {
  const file = loadExperimentsFile();
  let exp: ExperimentRecord | undefined;
  if (input.experimentId) {
    exp = file.experiments.find((e) => e.experiment_id === input.experimentId);
  } else {
    exp = file.experiments.find((e) => e.status === "active");
  }

  const ctx = input.evaluationContext ?? {};
  const context: Record<string, unknown> = {
    user_id: input.userId ?? "",
    project_type: ctx.projectType,
    climate_zone: ctx.climateZone,
    city_tier: ctx.cityTier,
    internal_user: ctx.internalUser ?? false,
  };

  if (!exp) {
    return {
      experiment_id: null,
      assigned_variant: "rules_only",
      served_variant: "rules_only",
      assignment_reason: "no_active_experiment",
      bucket_id: -1,
      evaluation_mode: "disabled",
    };
  }

  const out = assignForExperiment(exp, input.assignmentKey, context);
  if (!out) {
    const ctrl = String(exp.control_variant ?? "rules_only");
    return {
      experiment_id: exp.experiment_id,
      primary_variant: exp.primary_variant,
      assigned_variant: ctrl,
      served_variant: ctrl,
      assignment_reason: "experiment_not_active",
      bucket_id: -1,
      evaluation_mode: "disabled",
    };
  }
  return out;
}

/** Resolve registry directory for Python serving subprocess. */
export function resolveRegistryDirForVariant(
  variant: string,
  fallbackProductionDir?: string | null,
): string | undefined {
  const prod = fallbackProductionDir ?? process.env.HEATWISE_REGISTRY_DIR;
  if (variant === "rules_only" || variant === "shadow_only") {
    const empty = rulesOnlyRegistryDir();
    return empty;
  }
  if (variant === "hybrid_v1" || variant === "ml_heavy_v1") {
    return prod ?? undefined;
  }
  return prod ?? undefined;
}
