// ============================================================
// HeatWise — Layout Spatial Mapper
// recommendation-engine/layoutSpatialMapper.ts
//
// Converts a 2D LayoutSchema into a set of ARSpatialMapping
// anchors suitable for AR rendering (e.g. Three.js / WebXR).
// Coordinates are expressed in metres in a right-handed space
// with origin at top-left of the layout by default.
// ============================================================

import type {
  LayoutSchema,
  ARSpatialMapping,
  SpatialAnchor,
} from "@/models";

export function mapLayoutToSpatialAnchors(
  layout: LayoutSchema,
  origin: ARSpatialMapping["origin"] = "top_left",
): ARSpatialMapping {
  const anchors: SpatialAnchor[] = [];

  // Zones
  for (const zone of layout.zones) {
    anchors.push({
      id:        `zone:${zone.id}`,
      type:      zone.type === "path" ? "path" : "zone",
      label:     zone.label,
      positionM: toOriginSpace(origin, layout, {
        x: zone.x + zone.widthM / 2,
        y: zone.y + zone.lengthM / 2,
      }),
      sizeM: {
        width:  zone.widthM,
        length: zone.lengthM,
        height: zone.type === "existing" ? 0.1 : 0,
      },
      meta: {
        zoneType: zone.type,
        fill:     zone.fill,
      },
    });
  }

  // Modules
  for (const mod of layout.placedModules) {
    anchors.push({
      id:    `module:${mod.moduleId}`,
      type:  "module",
      label: mod.moduleName,
      positionM: toOriginSpace(origin, layout, {
        x: mod.x + mod.widthM / 2,
        y: mod.y + mod.lengthM / 2,
      }),
      sizeM: {
        width:  mod.widthM,
        length: mod.lengthM,
        height: 0.8,
      },
      meta: {
        rotationDeg: mod.rotation,
        quantity:    mod.quantity,
        notes:       mod.notes,
      },
    });
  }

  // Plants
  for (const plant of layout.placedPlants) {
    anchors.push({
      id:    `plant:${plant.plantId}:${plant.zone}:${plant.x.toFixed(2)}:${plant.y.toFixed(2)}`,
      type:  "plant",
      label: plant.plantName,
      positionM: toOriginSpace(origin, layout, {
        x: plant.x,
        y: plant.y,
      }),
      sizeM: {
        width:  plant.radiusM * 2,
        length: plant.radiusM * 2,
        height: plant.radiusM,
      },
      meta: {
        zoneId:   plant.zone,
        quantity: plant.quantity,
      },
    });
  }

  // Clear paths
  for (const path of layout.clearPaths) {
    anchors.push({
      id:    `path:${path.label}`,
      type:  "path",
      label: path.label,
      positionM: toOriginSpace(origin, layout, {
        x: path.x + path.widthM / 2,
        y: path.y + path.lengthM / 2,
      }),
      sizeM: {
        width:  path.widthM,
        length: path.lengthM,
        height: 0.01,
      },
    });
  }

  return {
    canvasWidthM:  layout.canvasWidthM,
    canvasLengthM: layout.canvasLengthM,
    origin,
    anchors,
  };
}

function toOriginSpace(
  origin: ARSpatialMapping["origin"],
  layout: LayoutSchema,
  pt: { x: number; y: number },
): { x: number; y: number; z: number } {
  if (origin === "top_left") {
    return { x: pt.x, y: 0, z: pt.y };
  }
  // center origin: shift so (0,0) is center of canvas
  const cx = layout.canvasWidthM / 2;
  const cz = layout.canvasLengthM / 2;
  return {
    x: pt.x - cx,
    y: 0,
    z: pt.y - cz,
  };
}

