// ============================================================
// HeatWise — Core Type Definitions
// models/index.ts
//
// Single source of truth for all domain types.
// No logic here — pure data shapes only.
// ============================================================

import type { SpeciesIdentityRef, SpeciesIdentityResolution } from "@/lib/species/speciesIdentityTypes";

// ─── Primitive Enums ────────────────────────────────────────

export type SpaceType        = "rooftop" | "terrace" | "balcony";
export type SunExposure      = "full" | "partial" | "shade";
export type WindLevel        = "low" | "medium" | "high";
export type BudgetRange      = "low" | "medium" | "high" | "premium";
export type MaintenanceLevel = "minimal" | "moderate" | "active";
export type UserGoal         = "cooling" | "aesthetic" | "food" | "mixed";
export type LayoutType       = "extensive" | "intensive" | "modular" | "container" | "vertical";
export type PlantType        = "succulent" | "climber" | "perennial" | "grass" | "shrub" | "vegetable" | "fern" | "herb";
export type ModuleType       = "planter" | "shade" | "irrigation" | "trellis" | "raised_bed" | "pergola" | "green_wall";
export type Confidence       = "low" | "medium" | "high";
export type Orientation      = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

// ─── User Input ─────────────────────────────────────────────

export interface ProjectInput {
  spaceType:        SpaceType;
  widthM:            number;
  lengthM:           number;
  floorLevel:        number;
  sunExposure:       SunExposure;
  windLevel:         WindLevel;
  waterAccess:       boolean;
  budgetRange:       BudgetRange;
  maintenanceLevel:  MaintenanceLevel;
  primaryGoal:       UserGoal;
  orientation?:      Orientation;
  latitude?:         number;
  longitude?:        number;
  existingStructures?: string[];
}

// Derived geometry — computed once, reused everywhere
export interface SpaceGeometry {
  areaSqM:        number;
  perimeter:      number;
  aspectRatio:   number;
  isNarrow:       boolean;
  isSmall:       boolean;
  isMedium:       boolean;
  isLarge:       boolean;
}

// ─── Plant Domain ────────────────────────────────────────────

export interface Plant {
  id:              string;
  name:            string;
  scientificName:  string;
  /** Prisma `SpeciesCatalog.code` when linked; null if not in catalog / ambiguous */
  speciesCatalogCode?: string | null;
  /** How `speciesCatalogCode` was derived (for training / audit) */
  speciesIdentityResolution?: SpeciesIdentityResolution;
  type:            PlantType;
  coolingScore:    number;
  sunRequirement:  SunExposure[];
  maintenance:     MaintenanceLevel;
  waterNeeds:      "low" | "medium" | "high";
  windTolerance:   WindLevel;
  minSpacingM:     number;
  heightM:         number;
  costPerUnit:     number;
  coverageSqM:     number;
  notes:           string;
  placementTip:    string;
}

// ─── Module Domain ────────────────────────────────────────────

export interface CoolingModule {
  id:                   string;
  name:                 string;
  type:                 ModuleType;
  widthM:               number;
  lengthM:              number;
  heightM:              number;
  unitCost:             number;
  installCost:          number;
  coolingContributionC: number;
  maintenanceLevel:     MaintenanceLevel;
  requiresWater:        boolean;
  requiresStructural:   boolean;
  minFloorLevel:        number;
  maxFloorLevel:        number;
  compatibleSpaces:     SpaceType[];
  description:          string;
  quantitySuggested?:  number;
}

// ─── Layout Template ─────────────────────────────────────────

export interface LayoutTemplate {
  id:                string;
  name:              string;
  type:              LayoutType;
  description:       string;
  eligibleSpaces:    SpaceType[];
  eligibleBudgets:   BudgetRange[];
  eligibleSun:       SunExposure[];
  eligibleMaint:     MaintenanceLevel[];
  eligibleGoals:     UserGoal[];
  minAreaSqM:        number;
  maxAreaSqM:        number;
  minWidthM:         number;
  requiresWater:     boolean;
  requiresStructural: boolean;
  moduleIds:         string[];
  plantTypes:        PlantType[];
  baseHeatReductionC: number;
  baseCoverageRatio:  number;
}

// ─── Scoring ─────────────────────────────────────────────────

export interface ScoringWeights {
  coolingEfficiency: number;
  costFit:           number;
  maintenanceFit:    number;
  goalAlignment:     number;
}

export interface ScoreBreakdown {
  coolingEfficiency: number;
  costFit:           number;
  maintenanceFit:    number;
  goalAlignment:     number;
  bonuses:           ScoringBonus[];
  penalties:         ScoringPenalty[];
  total:             number;
}

export interface ScoringBonus {
  reason: string;
  points: number;
}

export interface ScoringPenalty {
  reason: string;
  points: number;
}

// ─── Candidate ───────────────────────────────────────────────

export interface Candidate {
  template:        LayoutTemplate;
  resolvedModules: CoolingModule[];
  scoredPlants:    ScoredPlant[];
  heatEstimate:    HeatEstimate;
  costEstimate:    CostEstimate;
  score:           ScoreBreakdown;
}

export interface ScoredPlant {
  plant:          Plant;
  relevanceScore: number;
  quantity:       number;
  placementZone:  PlacementZone;
}

export interface HeatEstimate {
  valueC:         number;
  minC:           number;
  maxC:           number;
  energySavingPct: number;
  confidence:     Confidence;
  factors:        string[];
}

export interface CostEstimate {
  materialsMin:      number;
  materialsMax:     number;
  labourMin:        number;
  labourMax:        number;
  totalMin:         number;
  totalMax:         number;
  annualMaintenance: number;
  roiMonths:        number;
  currency:         string;
}

// ─── Recommendation Output ────────────────────────────────────

export interface Recommendation {
  rank:          number;
  candidate:     Candidate;
  explanation:   Explanation;
  layoutSchema:  LayoutSchema;
  /** Primary species identity for DB/ML alignment (Phase 5) */
  primarySpeciesIdentity?: SpeciesIdentityRef;
}

export interface Explanation {
  headline:      string;
  summary:       string;
  scoreFactors:  ScoreFactor[];
  tradeoffs:     string[];
  whyNotOthers?: string[];
}

export interface ScoreFactor {
  label:   string;
  impact:  "positive" | "negative" | "neutral";
  detail:  string;
}

// ─── Layout Schema ───────────────────────────────────────────

export interface LayoutSchema {
  canvasWidthM:   number;
  canvasLengthM: number;
  zones:          LayoutZone[];
  placedModules:  PlacedModule[];
  placedPlants:   PlacedPlant[];
  clearPaths:     ClearPath[];
  legend:         LegendEntry[];
  generatedAt:    string;
}

export interface LayoutZone {
  id:          string;
  label:       string;
  type:        "plant" | "module" | "path" | "buffer" | "existing";
  x:           number;
  y:           number;
  widthM:      number;
  lengthM:     number;
  fill:        string;
}

export interface PlacedModule {
  moduleId:    string;
  moduleName:  string;
  x:           number;
  y:           number;
  widthM:      number;
  lengthM:     number;
  rotation:    0 | 90 | 180 | 270;
  quantity:    number;
  notes:       string;
}

export interface PlacedPlant {
  plantId:     string;
  plantName:   string;
  /** Optional: SpeciesCatalog.code for export / AR meta */
  speciesCatalogCode?: string | null;
  x:           number;
  y:           number;
  radiusM:     number;
  quantity:    number;
  zone:        string;
}

export interface ClearPath {
  label:    string;
  x:        number;
  y:        number;
  widthM:   number;
  lengthM:  number;
}

export interface LegendEntry {
  label: string;
  color: string;
  type:  "zone" | "module" | "plant" | "path";
}

export type PlacementZone = "perimeter" | "center" | "north_wall" | "south_face" | "full_cover" | "container";

// ─── Spatial Mapping for AR ───────────────────────────────────

export interface SpatialAnchor {
  id:          string;
  type:        "module" | "plant" | "zone" | "path";
  label:       string;
  positionM:   { x: number; y: number; z: number };
  sizeM?:      { width: number; length: number; height?: number };
  meta?:       Record<string, unknown>;
}

export interface ARSpatialMapping {
  canvasWidthM:   number;
  canvasLengthM:  number;
  origin:         "top_left" | "center";
  anchors:        SpatialAnchor[];
}

// ─── Heat Reduction Meta Summary ──────────────────────────────

export interface HeatReductionSummary {
  estimatedDropC:       number;
  plantCoverageRatio:   number; // 0–1
  shadeCoverageRatio:   number; // 0–1
  reflectiveCoverageRatio: number; // 0–1
  effectiveSurfaceAreaM2:  number;
  confidence:           Confidence;
  drivers:              string[]; // human-readable factors
}

// ─── Recommendation Feedback Dataset ──────────────────────────

export type RecommendationFeedbackAction =
  | "view"
  | "expand_details"
  | "compare"
  | "save"
  | "dismiss"
  | "mark_installed"
  | "share";

export interface RecommendationFeedbackEvent {
  eventId:           string;
  userId?:           string;
  recommendationId:  string;   // composite key: e.g. projectId + rank
  projectId?:        string;
  candidateId?:      string;
  action:            RecommendationFeedbackAction;
  timestamp:         string;   // ISO
  dwellMs?:          number;
  scoreBefore?:      number;
  scoreAfter?:       number;
  notes?:            string;
  extra?:            Record<string, unknown>;
}

// ─── Pipeline I/O ─────────────────────────────────────────────

export interface PipelineResult {
  input:            ProjectInput;
  geometry:         SpaceGeometry;
  totalCandidates:  number;
  filteredCount:   number;
  recommendations: Recommendation[];
  pipelineLog:      PipelineLogEntry[];
  durationMs:       number;
}

export interface PipelineLogEntry {
  stage:   string;
  message: string;
  data?:   unknown;
}
