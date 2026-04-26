// ============================================================
// HeatWise — Layout Schema Generator
// src/engine/layoutSchemaGenerator.ts
//
// Responsibility: convert a chosen Recommendation into a
// LayoutSchema — a positioned, grid-aligned blueprint of
// exactly where each module and plant sits on the canvas.
//
// The schema is coordinate-based (metres from top-left origin)
// so it can be rendered as SVG, canvas, or a 3D preview
// without any further computation.
//
// Layout algorithm:
//   1. Divide the canvas into functional zones
//   2. Place structural modules (pergola, shade, trellis) first
//   3. Pack planter modules into remaining zones
//   4. Scatter plants within their assigned zones
//   5. Reserve clear paths (min 0.9m wide for access)
// ============================================================

import type {
  Recommendation,
  ProjectInput,
  SpaceGeometry,
  LayoutSchema,
  LayoutZone,
  PlacedModule,
  PlacedPlant,
  ClearPath,
  LegendEntry,
  CoolingModule,
  ScoredPlant,
  PlacementZone,
} from "@/models";

// ─── Public API ──────────────────────────────────────────────

/**
 * Generates a full LayoutSchema for the given recommendation.
 * Returns the schema; the recommendation is not mutated here —
 * the pipeline attaches it after calling this function.
 */
export function generateLayoutSchema(
  recommendation: Recommendation,
  input:          ProjectInput,
  geometry:       SpaceGeometry,
): LayoutSchema {
  const { candidate }   = recommendation;
  const { template }    = candidate;

  const ctx = buildContext(input, geometry);
  const zones           = buildZones(template.type, ctx);
  const { modules, usedArea } = placeModules(candidate.resolvedModules, zones, ctx);
  const plants          = placePlants(candidate.scoredPlants, zones, ctx, modules);
  const clearPaths      = buildClearPaths(ctx, template.type);
  const legend          = buildLegend(modules, plants, zones);

  return {
    canvasWidthM:  ctx.canvasW,
    canvasLengthM: ctx.canvasL,
    zones,
    placedModules: modules,
    placedPlants:  plants,
    clearPaths,
    legend,
    generatedAt:   new Date().toISOString(),
  };
}

// ─── Layout Context ───────────────────────────────────────────

interface LayoutContext {
  canvasW:    number;    // total width
  canvasL:    number;    // total length
  marginM:    number;    // edge safety margin
  pathW:      number;    // minimum access path width
  spaceType:  string;
  isNarrow:   boolean;
}

function buildContext(
  input:    ProjectInput,
  geometry: SpaceGeometry,
): LayoutContext {
  return {
    canvasW:   input.widthM,
    canvasL:   input.lengthM,
    marginM:   geometry.isNarrow ? 0.1 : 0.2,
    pathW:     geometry.isSmall  ? 0.6 : 0.9,
    spaceType: input.spaceType,
    isNarrow:  geometry.isNarrow,
  };
}

// ─── Zone Builder ─────────────────────────────────────────────

/**
 * Divides the canvas into semantic zones based on layout type.
 * All coordinates are in metres from the top-left corner.
 *
 * Zone types:
 *   plant   — available for planting modules
 *   module  — reserved for structural modules
 *   path    — mandatory access path
 *   buffer  — edge safety margin
 *   existing — pre-existing features
 */
function buildZones(
  layoutType: string,
  ctx:        LayoutContext,
): LayoutZone[] {
  const { canvasW: W, canvasL: L, marginM: M, pathW: P } = ctx;

  switch (layoutType) {
    case "extensive":
    case "intensive":
      // Full coverage — entire surface is one planting zone
      return [
        zone("z_full",    "Full Coverage",     "plant",  M, M, W - 2*M, L - 2*M, "green_light"),
        zone("z_edge_n",  "North Buffer",      "buffer", 0, 0, W, M,      "gray"),
        zone("z_edge_s",  "South Buffer",      "buffer", 0, L-M, W, M,   "gray"),
      ];

    case "modular":
      // Grid of modular trays with central access path
      return [
        zone("z_north",   "North Planting",    "plant",  M, M, W - 2*M, (L/2) - P/2 - M, "green_light"),
        zone("z_south",   "South Planting",    "plant",  M, L/2 + P/2, W - 2*M, L/2 - P/2 - M, "green_light"),
        zone("z_path",    "Access Path",       "path",   0, L/2 - P/2, W, P, "sand"),
        zone("z_edge_w",  "West Buffer",       "buffer", 0, 0, M, L, "gray"),
        zone("z_edge_e",  "East Buffer",       "buffer", W-M, 0, M, L, "gray"),
      ];

    case "vertical":
      // Trellis along back wall, containers in front
      const trellisDepth = Math.min(0.3, W * 0.15);
      return [
        zone("z_wall",    "Trellis / Climbing","module", 0, 0, trellisDepth, L, "green_dark"),
        zone("z_contain", "Container Zone",    "plant",  trellisDepth + P, P, W - trellisDepth - P*2, L - P*2, "green_light"),
        zone("z_path",    "Access Corridor",   "path",   trellisDepth, 0, P, L, "sand"),
      ];

    case "container":
      // Perimeter containers with open central space
      const rimW = Math.min(1.2, W * 0.30);
      return [
        zone("z_perim_n", "North Containers",  "plant",  M, M, W - 2*M, rimW, "green_light"),
        zone("z_perim_s", "South Containers",  "plant",  M, L - rimW - M, W - 2*M, rimW, "green_light"),
        zone("z_perim_w", "West Containers",   "plant",  M, rimW + M, rimW, L - 2*rimW - 2*M, "green_light"),
        zone("z_perim_e", "East Containers",   "plant",  W - rimW - M, rimW + M, rimW, L - 2*rimW - 2*M, "green_light"),
        zone("z_center",  "Open Space",        "path",   rimW + M, rimW + M, W - 2*(rimW + M), L - 2*(rimW + M), "sand"),
      ];

    default:
      // Fallback: single planting zone
      return [
        zone("z_all", "Planting Area", "plant", M, M, W - 2*M, L - 2*M, "green_light"),
      ];
  }
}

function zone(
  id: string, label: string, type: LayoutZone["type"],
  x: number, y: number, widthM: number, lengthM: number,
  fill: string,
): LayoutZone {
  return {
    id, label, type, fill,
    x:      round2(x),
    y:      round2(y),
    widthM: round2(Math.max(0, widthM)),
    lengthM: round2(Math.max(0, lengthM)),
  };
}

// ─── Module Placement ─────────────────────────────────────────

interface ModulePlacementResult {
  modules:  PlacedModule[];
  usedArea: number;
}

/**
 * Places modules into appropriate zones using a simple
 * left-to-right, top-to-bottom packing algorithm.
 * Structural modules (pergola, shade sail) go to module zones.
 * Planter modules fill plant zones row by row.
 */
function placeModules(
  resolvedModules: CoolingModule[],
  zones:           LayoutZone[],
  ctx:             LayoutContext,
): ModulePlacementResult {
  const placed: PlacedModule[] = [];
  let usedArea = 0;

  // Sort: structural modules first (they anchor the layout)
  const sorted = [...resolvedModules].sort((a, b) => {
    const PRIORITY: Record<string, number> = {
      pergola: 0, shade: 1, trellis: 2, irrigation: 3,
      green_wall: 4, raised_bed: 5, planter: 6,
    };
    return (PRIORITY[a.type] ?? 9) - (PRIORITY[b.type] ?? 9);
  });

  for (const module of sorted) {
    const qty = module.quantitySuggested ?? 1;
    const targetZoneType: LayoutZone["type"] =
      ["pergola", "shade", "trellis"].includes(module.type) ? "module" : "plant";

    // Find the best zone for this module type
    const targetZones = zones.filter((z) =>
      z.type === targetZoneType || z.type === "plant",
    );
    if (targetZones.length === 0) continue;

    const zoneForModule = targetZones[0];

    // Pack modules in a grid within the zone
    const modulesPerRow = Math.max(1,
      Math.floor(zoneForModule.widthM / (module.widthM + 0.1)),
    );

    let placed_count = 0;
    for (let i = 0; i < Math.min(qty, 20); i++) {
      const col = i % modulesPerRow;
      const row = Math.floor(i / modulesPerRow);

      const x = zoneForModule.x + col * (module.widthM + 0.1);
      const y = zoneForModule.y + row * (module.lengthM + 0.1);

      // Don't overflow the zone
      if (x + module.widthM > zoneForModule.x + zoneForModule.widthM) break;
      if (y + module.lengthM > zoneForModule.y + zoneForModule.lengthM) break;

      placed_count++;
    }

    if (placed_count > 0) {
      placed.push({
        moduleId:   module.id,
        moduleName: module.name,
        x:          round2(zoneForModule.x),
        y:          round2(zoneForModule.y),
        widthM:     module.widthM,
        lengthM:    module.lengthM,
        rotation:   0,
        quantity:   placed_count,
        notes:      buildModuleNote(module, placed_count),
      });
      usedArea += module.widthM * module.lengthM * placed_count;
    }
  }

  return { modules: placed, usedArea };
}

function buildModuleNote(module: CoolingModule, qty: number): string {
  if (module.type === "irrigation")
    return `Covers up to ${Math.round(qty * 60)}m² — install at water source access point.`;
  if (module.type === "pergola")
    return `Central structural anchor — install first, then train climbers.`;
  if (module.type === "shade")
    return `Tension between ${qty + 1} fixing points. Remove in storms.`;
  if (module.type === "raised_bed")
    return `Fill with 50% topsoil, 30% compost, 20% perlite.`;
  return `Arrange in ${Math.ceil(Math.sqrt(qty))}×${Math.ceil(qty / Math.ceil(Math.sqrt(qty)))} grid.`;
}

// ─── Plant Placement ──────────────────────────────────────────

/**
 * Places plants in their designated zones using a
 * pseudo-random but deterministic scatter pattern.
 * "Random" positions are derived from plant index × prime offsets
 * so the same input always produces the same layout.
 */
function placePlants(
  scoredPlants:  ScoredPlant[],
  zones:         LayoutZone[],
  ctx:           LayoutContext,
  placedModules: PlacedModule[],
): PlacedPlant[] {
  const placed: PlacedPlant[] = [];

  // Only place the top 5 plants by relevance
  const topPlants = scoredPlants.slice(0, 5);

  topPlants.forEach((sp, plantIndex) => {
    const { plant, quantity, placementZone } = sp;
    const targetZone = resolveZone(placementZone, zones);
    if (!targetZone) return;

    const actualQty = Math.min(quantity, 12); // cap per plant at 12 for readability

    for (let i = 0; i < actualQty; i++) {
      // Deterministic scatter using index-based offsets
      const PRIME_X = [0.17, 0.31, 0.53, 0.71, 0.11, 0.43, 0.67, 0.23, 0.59, 0.37, 0.79, 0.13];
      const PRIME_Y = [0.29, 0.47, 0.61, 0.19, 0.83, 0.37, 0.53, 0.71, 0.23, 0.67, 0.41, 0.89];

      const xFrac = PRIME_X[(plantIndex * 3 + i) % PRIME_X.length];
      const yFrac = PRIME_Y[(plantIndex * 3 + i) % PRIME_Y.length];

      const margin = plant.minSpacingM * 0.5;
      const x = round2(
        targetZone.x + margin + xFrac * Math.max(0, targetZone.widthM - 2*margin - plant.minSpacingM)
      );
      const y = round2(
        targetZone.y + margin + yFrac * Math.max(0, targetZone.lengthM - 2*margin - plant.minSpacingM)
      );

      placed.push({
        plantId:   plant.id,
        plantName: plant.name,
        speciesCatalogCode: plant.speciesCatalogCode ?? null,
        x,
        y,
        radiusM:   round2(plant.coverageSqM > 0 ? Math.sqrt(plant.coverageSqM / Math.PI) : 0.2),
        quantity:  1,
        zone:      targetZone.id,
      });
    }
  });

  return placed;
}

function resolveZone(
  placementZone: PlacementZone,
  zones:         LayoutZone[],
): LayoutZone | undefined {
  // Try to find the most specific matching zone
  const ZONE_PRIORITY: Record<PlacementZone, string[]> = {
    "north_wall":  ["z_wall",    "z_perim_n", "z_north", "z_all"],
    "perimeter":   ["z_perim_n", "z_perim_e", "z_perim_w", "z_perim_s", "z_north"],
    "south_face":  ["z_perim_s", "z_south",   "z_all"],
    "full_cover":  ["z_full",    "z_north",   "z_all", "z_contain"],
    "center":      ["z_center",  "z_full",    "z_all"],
    "container":   ["z_contain", "z_perim_n", "z_north", "z_all"],
  };

  const preferred = ZONE_PRIORITY[placementZone] ?? ["z_all"];
  for (const id of preferred) {
    const found = zones.find((z) => z.id === id && z.type !== "path" && z.type !== "buffer");
    if (found) return found;
  }

  // Fallback: any non-path zone
  return zones.find((z) => z.type === "plant" || z.type === "module");
}

// ─── Clear Paths ──────────────────────────────────────────────

function buildClearPaths(
  ctx:        LayoutContext,
  layoutType: string,
): ClearPath[] {
  const { canvasW: W, canvasL: L, pathW: P } = ctx;
  const paths: ClearPath[] = [];

  // Every layout needs at least one access path from entry
  if (layoutType === "modular" || layoutType === "intensive" || layoutType === "extensive") {
    paths.push({
      label:  "Main Access Path",
      x:      round2(W/2 - P/2),
      y:      0,
      widthM: P,
      lengthM: L,
    });
  }

  if (layoutType === "container" || layoutType === "vertical") {
    paths.push({
      label:  "Perimeter Access",
      x:      0,
      y:      round2(L/2 - P/2),
      widthM: W,
      lengthM: P,
    });
  }

  return paths;
}

// ─── Legend ───────────────────────────────────────────────────

function buildLegend(
  modules: PlacedModule[],
  plants:  PlacedPlant[],
  zones:   LayoutZone[],
): LegendEntry[] {
  const entries: LegendEntry[] = [];
  const seen = new Set<string>();

  // Zone types
  const ZONE_COLORS: Record<string, string> = {
    plant:    "#4ade80",
    module:   "#60a5fa",
    path:     "#fcd34d",
    buffer:   "#94a3b8",
    existing: "#f87171",
  };

  for (const zone of zones) {
    if (!seen.has(zone.type)) {
      seen.add(zone.type);
      entries.push({
        label: zone.type.charAt(0).toUpperCase() + zone.type.slice(1) + " Zone",
        color: ZONE_COLORS[zone.type] ?? "#ccc",
        type:  "zone",
      });
    }
  }

  // Unique modules
  const modulesSeen = new Set<string>();
  for (const m of modules) {
    if (!modulesSeen.has(m.moduleId)) {
      modulesSeen.add(m.moduleId);
      entries.push({ label: m.moduleName, color: "#3b82f6", type: "module" });
    }
  }

  // Unique plants
  const plantsSeen = new Set<string>();
  const PLANT_COLORS = ["#16a34a", "#15803d", "#166534", "#14532d", "#052e16"];
  let pIdx = 0;
  for (const p of plants) {
    if (!plantsSeen.has(p.plantId)) {
      plantsSeen.add(p.plantId);
      entries.push({
        label: p.plantName,
        color: PLANT_COLORS[pIdx++ % PLANT_COLORS.length],
        type:  "plant",
      });
    }
  }

  return entries;
}

// ─── Utilities ───────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
