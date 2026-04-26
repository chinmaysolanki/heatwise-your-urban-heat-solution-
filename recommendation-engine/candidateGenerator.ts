// ============================================================
// HeatWise — Candidate Generator
// recommendation-engine/candidateGenerator.ts
// ============================================================

import type {
  ProjectInput,
  SpaceGeometry,
  Candidate,
  LayoutTemplate,
  CoolingModule,
  ScoredPlant,
  HeatEstimate,
  CostEstimate,
  PlacementZone,
} from "@/models";

import { LAYOUT_TEMPLATES } from "./templates";
import { COOLING_MODULES } from "./modules";
import { PLANT_LIBRARY } from "./plants";

export function generateAllCandidates(
  input:    ProjectInput,
  geometry: SpaceGeometry,
): Candidate[] {
  return LAYOUT_TEMPLATES.map((template) =>
    buildCandidate(template, input, geometry),
  );
}

function buildCandidate(
  template: LayoutTemplate,
  input:    ProjectInput,
  geometry: SpaceGeometry,
): Candidate {
  const resolvedModules = resolveModules(template, geometry);
  const scoredPlants    = scorePlants(template, input, geometry);
  const heatEstimate    = estimateHeat(template, input, geometry, resolvedModules);
  const costEstimate    = estimateCost(template, input, geometry, resolvedModules, scoredPlants);

  return {
    template,
    resolvedModules,
    scoredPlants,
    heatEstimate,
    costEstimate,
    score: {
      coolingEfficiency: 0,
      costFit:           0,
      maintenanceFit:    0,
      goalAlignment:     0,
      bonuses:           [],
      penalties:         [],
      total:             0,
    },
  };
}

function resolveModules(
  template: LayoutTemplate,
  geometry: SpaceGeometry,
): CoolingModule[] {
  const AREA_BASED_TYPES = new Set(["planter"]);

  return template.moduleIds.flatMap((id) => {
    const module = COOLING_MODULES.find((m) => m.id === id);
    if (!module) return [];

    const resolved = { ...module };

    if (AREA_BASED_TYPES.has(resolved.type) &&
        resolved.widthM === 1 && resolved.lengthM === 1) {
      resolved.quantitySuggested = Math.ceil(
        geometry.areaSqM * template.baseCoverageRatio,
      );
    } else {
      resolved.quantitySuggested = computeFixedQuantity(
        resolved, geometry, template,
      );
    }

    return [resolved];
  });
}

function computeFixedQuantity(
  module:   CoolingModule,
  geometry: SpaceGeometry,
  template: LayoutTemplate,
): number {
  const usableArea = geometry.areaSqM * template.baseCoverageRatio;
  const moduleArea = module.widthM * module.lengthM;

  if (moduleArea === 0) return 1;
  if (moduleArea >= 4) return 1;

  const rawCount = Math.floor(usableArea / moduleArea);
  return Math.max(1, rawCount);
}

function scorePlants(
  template: LayoutTemplate,
  input:    ProjectInput,
  geometry: SpaceGeometry,
): ScoredPlant[] {
  const MAINT_ORDER: Record<string, number> = {
    minimal: 1, moderate: 2, active: 3,
  };

  const filtered = PLANT_LIBRARY.filter((plant) => {
    if (!template.plantTypes.includes(plant.type)) return false;
    if (!plant.sunRequirement.includes(input.sunExposure)) return false;
    if (MAINT_ORDER[plant.maintenance] > MAINT_ORDER[input.maintenanceLevel])
      return false;
    if (!input.waterAccess && plant.waterNeeds !== "low") return false;
    if (input.windLevel === "high" && plant.windTolerance === "low")
      return false;
    if (geometry.isNarrow && plant.coverageSqM > 0.5) return false;

    return true;
  });

  return filtered.map((plant) => {
    const relevanceScore = computePlantRelevance(plant, input, template);
    const quantity       = computePlantQuantity(plant, geometry, template);
    const placementZone  = assignPlacementZone(plant, template);

    return { plant, relevanceScore, quantity, placementZone };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function computePlantRelevance(
  plant:    (typeof PLANT_LIBRARY)[0],
  input:    ProjectInput,
  template: LayoutTemplate,
): number {
  let score = plant.coolingScore * 5;

  const goalBonus: Record<string, string[]> = {
    cooling:   ["succulent", "climber", "grass", "perennial", "fern"],
    food:      ["vegetable", "herb"],
    aesthetic: ["shrub", "climber", "perennial", "fern"],
    mixed:     ["perennial", "herb", "climber", "shrub"],
  };
  if (goalBonus[input.primaryGoal]?.includes(plant.type)) score += 20;

  if (input.maintenanceLevel === "minimal" && plant.maintenance === "minimal")
    score += 10;
  if (input.windLevel === "high" && plant.windTolerance === "high")
    score += 10;
  if (!input.waterAccess && plant.waterNeeds === "low") score += 10;

  return Math.min(100, score);
}

function computePlantQuantity(
  plant:    (typeof PLANT_LIBRARY)[0],
  geometry: SpaceGeometry,
  template: LayoutTemplate,
): number {
  const usableArea = geometry.areaSqM * template.baseCoverageRatio;
  const spacingArea = plant.minSpacingM * plant.minSpacingM;
  return Math.max(1, Math.floor(usableArea / spacingArea / 3));
}

function assignPlacementZone(
  plant:    (typeof PLANT_LIBRARY)[0],
  template: LayoutTemplate,
): PlacementZone {
  if (plant.type === "climber")     return "north_wall";
  if (plant.type === "fern")        return "perimeter";
  if (plant.type === "vegetable")   return "full_cover";
  if (template.type === "vertical") return "north_wall";
  if (template.type === "container") return "container";
  if (plant.heightM > 1.0)          return "perimeter";
  return "full_cover";
}

function estimateHeat(
  template:   LayoutTemplate,
  input:      ProjectInput,
  geometry:   SpaceGeometry,
  modules:    CoolingModule[],
): HeatEstimate {
  const SUN_MULT:  Record<string, number> = { full: 1.30, partial: 1.00, shade: 0.60 };
  const WIND_MULT: Record<string, number> = { low:  1.05, medium:  1.00, high:  0.80 };

  const scaleMult = Math.min(1.65, 1 + (geometry.areaSqM / 250));

  const moduleCooling = modules.reduce(
    (sum, m) => sum + m.coolingContributionC, 0,
  );

  const baseValue = (
    template.baseHeatReductionC
    * SUN_MULT[input.sunExposure]
    * WIND_MULT[input.windLevel]
    * scaleMult
  ) + moduleCooling;

  const valueC     = parseFloat(baseValue.toFixed(1));
  const spread     = valueC * 0.20;

  const factors: string[] = [];
  if (input.sunExposure === "full")    factors.push("Full sun maximises evapotranspiration");
  if (input.sunExposure === "shade")   factors.push("Shade reduces solar gain benefit");
  if (geometry.isLarge)                factors.push("Large area amplifies cooling effect");
  if (geometry.isSmall)                factors.push("Small area limits total cooling impact");
  if (input.windLevel === "high")      factors.push("High wind reduces retained cool air");
  if (modules.some(m => m.requiresWater && m.coolingContributionC > 0))
                                       factors.push("Irrigation adds evaporative cooling");

  return {
    valueC,
    minC:          parseFloat((valueC - spread).toFixed(1)),
    maxC:          parseFloat((valueC + spread).toFixed(1)),
    energySavingPct: Math.round(valueC * 4.2),
    confidence:    geometry.areaSqM > 20 ? "high"
                 : geometry.areaSqM > 8  ? "medium" : "low",
    factors,
  };
}

function estimateCost(
  template:  LayoutTemplate,
  input:     ProjectInput,
  geometry:  SpaceGeometry,
  modules:   CoolingModule[],
  plants:    ScoredPlant[],
): CostEstimate {
  const LABOUR_RATIO: Record<string, number> = {
    rooftop: 0.45, terrace: 0.35, balcony: 0.22,
  };

  const MAINT_RATIO: Record<string, number> = {
    minimal: 0.04, moderate: 0.08, active: 0.14,
  };

  const ENERGY_SAVING_PER_DEG_USD = 52;

  const moduleMaterialCost = modules.reduce((sum, m) => {
    const qty = m.quantitySuggested ?? 1;
    return sum + m.unitCost * qty;
  }, 0);

  const plantMaterialCost = plants.slice(0, 5).reduce((sum, sp) => {
    return sum + sp.plant.costPerUnit * sp.quantity;
  }, 0);

  const moduleInstallCost = modules.reduce((sum, m) => {
    const qty = m.quantitySuggested ?? 1;
    return sum + m.installCost * qty;
  }, 0);

  const totalMaterials = moduleMaterialCost + plantMaterialCost;
  const labourRatio    = LABOUR_RATIO[input.spaceType] ?? 0.35;
  const labourBase     = totalMaterials * labourRatio + moduleInstallCost;

  const matMin    = Math.round(totalMaterials * 0.90);
  const matMax    = Math.round(totalMaterials * 1.25);
  const labMin    = Math.round(labourBase * 0.85);
  const labMax    = Math.round(labourBase * 1.20);
  const totalMin  = matMin + labMin;
  const totalMax  = matMax + labMax;
  const totalMid  = (totalMin + totalMax) / 2;

  const maintRatio  = MAINT_RATIO[input.maintenanceLevel];
  const annualMaint = Math.round(totalMid * maintRatio);

  const approxHeatC  = template.baseHeatReductionC;
  const annualSaving = approxHeatC * ENERGY_SAVING_PER_DEG_USD;
  const roiMonths    = annualSaving > 0
    ? Math.round((totalMin / annualSaving) * 12)
    : 999;

  return {
    materialsMin:      matMin,
    materialsMax:      matMax,
    labourMin:         labMin,
    labourMax:         labMax,
    totalMin,
    totalMax,
    annualMaintenance: annualMaint,
    roiMonths:         Math.min(roiMonths, 999),
    currency:          "USD",
  };
}
