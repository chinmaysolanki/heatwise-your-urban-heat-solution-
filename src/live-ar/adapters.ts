import type { LiveARMeasurementResult } from "./types";
import type { ProjectInput, SpaceType, SunExposure, WindLevel, BudgetRange, MaintenanceLevel, UserGoal } from "@/models";

export interface LiveARtoProjectInputOptions {
  spaceType?: SpaceType;
  sunExposure?: SunExposure;
  windLevel?: WindLevel;
  budgetRange?: BudgetRange;
  maintenanceLevel?: MaintenanceLevel;
  primaryGoal?: UserGoal;
  floorLevel?: number;
}

export function liveARMeasurementToProjectInput(
  measurement: LiveARMeasurementResult,
  opts: LiveARtoProjectInputOptions,
): ProjectInput {
  const spaceType: SpaceType = opts.spaceType ?? "rooftop";
  const areaSqM = measurement.polygon?.areaSqM;
  const width =
    measurement.widthM ?? (areaSqM != null && areaSqM > 0 ? Math.sqrt(areaSqM) : 6);
  const length =
    measurement.lengthM ?? (areaSqM != null && areaSqM > 0 ? Math.sqrt(areaSqM) : 7);

  return {
    spaceType,
    widthM: width,
    lengthM: length,
    floorLevel: opts.floorLevel ?? 1,
    sunExposure: opts.sunExposure ?? "full",
    windLevel: opts.windLevel ?? "medium",
    waterAccess: true,
    budgetRange: opts.budgetRange ?? "medium",
    maintenanceLevel: opts.maintenanceLevel ?? "moderate",
    primaryGoal: opts.primaryGoal ?? "cooling",
  };
}

