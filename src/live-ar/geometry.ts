import type { WorldPoint3D, MeasurementEdge, MeasurementPolygon, LiveARMeasurementResult } from "./types";
import type { Confidence } from "@/models";

export function distance3D(a: WorldPoint3D, b: WorldPoint3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function computeEdges(points: WorldPoint3D[]): MeasurementEdge[] {
  if (points.length < 2) return [];
  const edges: MeasurementEdge[] = [];
  for (let i = 0; i < points.length; i++) {
    const from = points[i];
    const to = points[(i + 1) % points.length];
    edges.push({
      id: `edge_${from.id}_${to.id}`,
      fromPointId: from.id,
      toPointId: to.id,
      lengthM: distance3D(from, to),
    });
  }
  return edges;
}

export function computePolygon(points: WorldPoint3D[]): MeasurementPolygon | null {
  if (points.length < 3) return null;
  // Project onto XZ plane and use shoelace formula.
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += p1.x * p2.z - p2.x * p1.z;
  }
  const areaSqM = Math.abs(area) * 0.5;
  const edges = computeEdges(points);
  const perimeterM = edges.reduce((acc, e) => acc + e.lengthM, 0);
  return {
    id: "poly_main",
    pointIds: points.map(p => p.id),
    areaSqM,
    perimeterM,
    selfIntersecting: isSelfCrossing(points),
  };
}

// Simple O(n^2) segment intersection detection for polygon self-crossing.
export function isSelfCrossing(points: WorldPoint3D[]): boolean {
  if (points.length < 4) return false;
  const n = points.length;
  const segs: Array<[{ x: number; z: number }, { x: number; z: number }]> = [];
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    segs.push([{ x: p1.x, z: p1.z }, { x: p2.x, z: p2.z }]);
  }

  const orient = (a: { x: number; z: number }, b: { x: number; z: number }, c: { x: number; z: number }) =>
    (b.z - a.z) * (c.x - b.x) - (b.x - a.x) * (c.z - b.z);

  const onSeg = (a: any, b: any, c: any) =>
    Math.min(a.x, b.x) <= c.x && c.x <= Math.max(a.x, b.x) &&
    Math.min(a.z, b.z) <= c.z && c.z <= Math.max(a.z, b.z);

  const inter = (p1:any,q1:any,p2:any,q2:any) => {
    const o1 = orient(p1,q1,p2);
    const o2 = orient(p1,q1,q2);
    const o3 = orient(p2,q2,p1);
    const o4 = orient(p2,q2,q1);
    if (o1 * o2 < 0 && o3 * o4 < 0) return true;
    if (o1 === 0 && onSeg(p1,q1,p2)) return true;
    if (o2 === 0 && onSeg(p1,q1,q2)) return true;
    if (o3 === 0 && onSeg(p2,q2,p1)) return true;
    if (o4 === 0 && onSeg(p2,q2,q1)) return true;
    return false;
  };

  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      // Skip adjacent segments and first/last pair
      if (Math.abs(i - j) === 1 || (i === 0 && j === segs.length - 1)) continue;
      if (inter(segs[i][0], segs[i][1], segs[j][0], segs[j][1])) return true;
    }
  }
  return false;
}

export function boundingBox(points: WorldPoint3D[]): { widthM: number; lengthM: number } | null {
  if (!points.length) return null;
  let minX = points[0].x;
  let maxX = points[0].x;
  let minZ = points[0].z;
  let maxZ = points[0].z;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return {
    widthM: Math.abs(maxX - minX),
    lengthM: Math.abs(maxZ - minZ),
  };
}

export function estimateConfidenceFromTracking(
  trackingQuality: LiveARMeasurementResult["trackingQuality"],
  pointCount: number,
  updates: number,
  selfCrossing: boolean,
): { level: Confidence; score: number } {
  // Base score from tracking quality
  let score = 0;
  if (trackingQuality === "excellent") score = 0.9;
  else if (trackingQuality === "good") score = 0.7;
  else if (trackingQuality === "limited") score = 0.4;
  else score = 0.2;

  // More points and more updates → more stability
  score += Math.min(pointCount / 8, 0.2);
  score += Math.min(updates / 20, 0.1);

  // Penalize self-crossing polygons heavily
  if (selfCrossing) score *= 0.4;

  // Clamp
  score = Math.max(0, Math.min(1, score));

  let level: Confidence;
  if (score >= 0.75) level = "high";
  else if (score >= 0.45) level = "medium";
  else level = "low";

  return { level, score };
}

export function buildMeasurementResult(params: {
  id?: string;
  points: WorldPoint3D[];
  trackingQuality: LiveARMeasurementResult["trackingQuality"];
  updates?: number;
  arSessionMeta?: Record<string, unknown>;
}): LiveARMeasurementResult {
  const edges = computeEdges(params.points);
  const polygon = computePolygon(params.points);
  const bbox = boundingBox(params.points);
  const { level, score } = estimateConfidenceFromTracking(
    params.trackingQuality,
    params.points.length,
    params.updates ?? 0,
    !!polygon?.selfIntersecting,
  );
  const now = new Date().toISOString();

  return {
    id: params.id ?? `measure_${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    points: params.points,
    edges,
    polygon,
    widthM: bbox?.widthM ?? null,
    lengthM: bbox?.lengthM ?? null,
    trackingQuality: params.trackingQuality,
    confidence: level,
    confidenceScore: score,
    arSessionMeta: params.arSessionMeta,
  };
}

