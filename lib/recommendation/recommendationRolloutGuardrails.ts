/**
 * Env-tunable thresholds for admin rollout health. Values are shares in [0,1] unless noted.
 */
export type RolloutGuardrailThresholds = {
  /** Alert if catalog_hybrid_ts share exceeds this (fallback overuse). */
  maxCatalogHybridShare: number;
  /** Alert if rules-only emergency share exceeds this. */
  maxRulesEmergencyShare: number;
  /** Alert if mean species_catalog_code coverage on ML candidates falls below this. */
  minMlSpeciesCodeCoverageShare: number;
  /** Alert if layout failure share (among eligible) exceeds this. */
  maxLayoutFailureShare: number;
};

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

export function loadRolloutGuardrailThresholds(): RolloutGuardrailThresholds {
  return {
    maxCatalogHybridShare: numEnv("HEATWISE_GUARD_CATALOG_HYBRID_SHARE_MAX", 0.45),
    maxRulesEmergencyShare: numEnv("HEATWISE_GUARD_RULES_EMERGENCY_SHARE_MAX", 0.08),
    minMlSpeciesCodeCoverageShare: numEnv("HEATWISE_GUARD_ML_SPECIES_CODE_COVERAGE_MIN", 0.35),
    maxLayoutFailureShare: numEnv("HEATWISE_GUARD_LAYOUT_FAILURE_SHARE_MAX", 0.12),
  };
}

export type RolloutGuardrailAlert = {
  code: string;
  severity: "warn" | "critical";
  message: string;
  observed: number;
  threshold: number;
};

export type RolloutGuardrailInputs = {
  catalogHybridShare: number | null;
  rulesEmergencyShare: number | null;
  mlSpeciesCodeCoverageMean: number | null;
  layoutFailureAmongEligibleShare: number | null;
};

export function evaluateRolloutGuardrails(
  stats: RolloutGuardrailInputs,
  t: RolloutGuardrailThresholds,
): RolloutGuardrailAlert[] {
  const alerts: RolloutGuardrailAlert[] = [];

  if (stats.catalogHybridShare != null && stats.catalogHybridShare > t.maxCatalogHybridShare) {
    alerts.push({
      code: "HIGH_CATALOG_HYBRID_FALLBACK_SHARE",
      severity: stats.catalogHybridShare > t.maxCatalogHybridShare + 0.15 ? "critical" : "warn",
      message: "Catalog hybrid fallback share exceeded threshold (check Python serving / registry).",
      observed: stats.catalogHybridShare,
      threshold: t.maxCatalogHybridShare,
    });
  }

  if (stats.rulesEmergencyShare != null && stats.rulesEmergencyShare > t.maxRulesEmergencyShare) {
    alerts.push({
      code: "HIGH_RULES_ONLY_EMERGENCY_SHARE",
      severity: "critical",
      message: "Rules-only emergency path exceeded threshold (catalog + DB may be unhealthy).",
      observed: stats.rulesEmergencyShare,
      threshold: t.maxRulesEmergencyShare,
    });
  }

  if (
    stats.mlSpeciesCodeCoverageMean != null &&
    stats.mlSpeciesCodeCoverageMean < t.minMlSpeciesCodeCoverageShare
  ) {
    alerts.push({
      code: "LOW_ML_SPECIES_CATALOG_CODE_COVERAGE",
      severity: "warn",
      message: "Mean species_catalog_code coverage on ML candidates below threshold.",
      observed: stats.mlSpeciesCodeCoverageMean,
      threshold: t.minMlSpeciesCodeCoverageShare,
    });
  }

  if (
    stats.layoutFailureAmongEligibleShare != null &&
    stats.layoutFailureAmongEligibleShare > t.maxLayoutFailureShare
  ) {
    alerts.push({
      code: "HIGH_LAYOUT_FAILURE_SHARE",
      severity: "warn",
      message: "Layout orchestration failure share (among attached+failed) exceeded threshold.",
      observed: stats.layoutFailureAmongEligibleShare,
      threshold: t.maxLayoutFailureShare,
    });
  }

  return alerts;
}
