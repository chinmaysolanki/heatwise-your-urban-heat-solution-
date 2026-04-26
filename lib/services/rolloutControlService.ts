import fs from "fs";
import path from "path";

import type { ExperimentRecord, ExperimentsFile, RolloutStateFile } from "@/lib/ml/evaluationTypes";
import { loadExperimentsFile } from "@/lib/services/experimentAssignmentService";

function rolloutStatePath(): string {
  const base = process.env.HEATWISE_EVALUATION_DATA_DIR ?? path.join(process.cwd(), "ml/evaluation/data");
  return path.join(base, "rollout_state.json");
}

export function readRolloutState(): RolloutStateFile {
  const p = rolloutStatePath();
  if (!fs.existsSync(p)) {
    return {
      active_experiment_id: null,
      current_phase: "rules_only",
      last_gate_outcome: "HOLD",
      last_evaluated_at: null,
      traffic_percent_for_treatment: 0,
    };
  }
  return JSON.parse(fs.readFileSync(p, "utf8")) as RolloutStateFile;
}

export function listActiveExperiments(experiments: ExperimentsFile): ExperimentRecord[] {
  return experiments.experiments.filter((e) => e.status === "active");
}

export function getRolloutStatusSnapshot(): {
  rollout: RolloutStateFile;
  experiments: ExperimentsFile;
  activeExperiments: ExperimentRecord[];
} {
  const experiments = loadExperimentsFile();
  return {
    rollout: readRolloutState(),
    experiments,
    activeExperiments: listActiveExperiments(experiments),
  };
}
