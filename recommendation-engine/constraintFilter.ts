// ============================================================
// HeatWise — Constraint Filter
// recommendation-engine/constraintFilter.ts
// ============================================================

import type { Candidate, ProjectInput, SpaceGeometry, PipelineLogEntry } from "@/models";

export interface FilterResult {
  passed:   Candidate[];
  rejected: RejectedCandidate[];
  log:      PipelineLogEntry[];
}

export interface RejectedCandidate {
  candidate:       Candidate;
  reasons:         RejectionReason[];
}

export interface RejectionReason {
  rule:    string;
  detail:  string;
}

export function filterCandidates(
  candidates: Candidate[],
  input:      ProjectInput,
  geometry:   SpaceGeometry,
): FilterResult {
  const passed:   Candidate[]         = [];
  const rejected: RejectedCandidate[] = [];
  const log:      PipelineLogEntry[]  = [];

  for (const candidate of candidates) {
    const reasons = applyAllRules(candidate, input, geometry);

    if (reasons.length === 0) {
      passed.push(candidate);
      log.push({
        stage:   "filter",
        message: `✓ PASS  — "${candidate.template.name}"`,
      });
    } else {
      rejected.push({ candidate, reasons });
      log.push({
        stage:   "filter",
        message: `✗ REJECT — "${candidate.template.name}": ${reasons.map(r => r.detail).join(" | ")}`,
        data:    reasons,
      });
    }
  }

  if (passed.length === 0 && rejected.length > 0) {
    const rescued = rejected[0].candidate;
    passed.push(rescued);
    log.push({
      stage:   "filter",
      message: `⚠ RESCUE — No candidates passed. Re-admitting "${rescued.template.name}" as fallback.`,
    });
  }

  return { passed, rejected, log };
}

function applyAllRules(
  candidate: Candidate,
  input:     ProjectInput,
  geometry:  SpaceGeometry,
): RejectionReason[] {
  const t = candidate.template;
  const reasons: RejectionReason[] = [];

  if (!t.eligibleSpaces.includes(input.spaceType)) {
    reasons.push({
      rule:   "space_type",
      detail: `Template requires ${t.eligibleSpaces.join(" or ")}, got ${input.spaceType}`,
    });
  }

  if (!t.eligibleBudgets.includes(input.budgetRange)) {
    reasons.push({
      rule:   "budget",
      detail: `Template requires budget ${t.eligibleBudgets.join("/")}; user selected "${input.budgetRange}"`,
    });
  }

  if (!t.eligibleSun.includes(input.sunExposure)) {
    reasons.push({
      rule:   "sun_exposure",
      detail: `Template designed for ${t.eligibleSun.join(" or ")} sun; space has "${input.sunExposure}"`,
    });
  }

  if (!t.eligibleMaint.includes(input.maintenanceLevel)) {
    reasons.push({
      rule:   "maintenance",
      detail: `Template needs "${t.eligibleMaint.join("/")}"; user can manage "${input.maintenanceLevel}"`,
    });
  }

  if (!t.eligibleGoals.includes(input.primaryGoal)) {
    reasons.push({
      rule:   "goal_mismatch",
      detail: `Template optimised for [${t.eligibleGoals.join(", ")}]; user goal is "${input.primaryGoal}"`,
    });
  }

  if (geometry.areaSqM < t.minAreaSqM) {
    reasons.push({
      rule:   "min_area",
      detail: `Template requires ≥${t.minAreaSqM}m²; space is ${geometry.areaSqM}m²`,
    });
  }

  if (geometry.areaSqM > t.maxAreaSqM) {
    reasons.push({
      rule:   "max_area",
      detail: `Template suited for ≤${t.maxAreaSqM}m²; space is ${geometry.areaSqM}m² (consider a larger system)`,
    });
  }

  if (input.widthM < t.minWidthM) {
    reasons.push({
      rule:   "min_width",
      detail: `Template requires ≥${t.minWidthM}m width; space is ${input.widthM}m wide`,
    });
  }

  if (t.requiresWater && !input.waterAccess) {
    reasons.push({
      rule:   "water_access",
      detail: `Template requires water access (irrigation); user has none`,
    });
  }

  if (t.requiresStructural) {
    if (input.spaceType === "balcony" && input.floorLevel > 4) {
      reasons.push({
        rule:   "structural",
        detail: `Template needs structural reinforcement; balcony on floor ${input.floorLevel} likely unsupported`,
      });
    }
    if (input.spaceType === "rooftop" && input.floorLevel > 20) {
      reasons.push({
        rule:   "structural_highrise",
        detail: `Intensive systems on floors above 20 require structural engineering assessment`,
      });
    }
  }

  const floorViolations = candidate.resolvedModules.filter(
    (m) => input.floorLevel < m.minFloorLevel || input.floorLevel > m.maxFloorLevel,
  );
  if (floorViolations.length > 0) {
    reasons.push({
      rule:   "module_floor_range",
      detail: `Module(s) [${floorViolations.map(m => m.name).join(", ")}] not suitable for floor ${input.floorLevel}`,
    });
  }

  if (candidate.scoredPlants.length === 0) {
    reasons.push({
      rule:   "no_compatible_plants",
      detail: `No plants in the library satisfy all constraints for this template`,
    });
  }

  if (
    input.spaceType === "balcony" &&
    input.windLevel === "high" &&
    input.floorLevel > 10 &&
    t.type === "vertical"
  ) {
    reasons.push({
      rule:   "wind_vertical_highrise",
      detail: `Vertical/trellis systems are unsafe on high-wind balconies above floor 10`,
    });
  }

  return reasons;
}
