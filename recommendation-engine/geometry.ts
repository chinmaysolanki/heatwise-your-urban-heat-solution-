// ============================================================
// HeatWise — Space Geometry Calculator
// recommendation-engine/geometry.ts
// ============================================================

import type { ProjectInput, SpaceGeometry } from "@/models";

export function computeGeometry(input: ProjectInput): SpaceGeometry {
  const areaSqM   = parseFloat((input.widthM * input.lengthM).toFixed(2));
  const perimeter = parseFloat((2 * (input.widthM + input.lengthM)).toFixed(2));
  const aspectRatio = parseFloat((input.widthM / input.lengthM).toFixed(3));

  return {
    areaSqM,
    perimeter,
    aspectRatio,
    isNarrow: input.widthM < 2.0,
    isSmall:  areaSqM < 6,
    isMedium: areaSqM >= 6 && areaSqM <= 30,
    isLarge:  areaSqM > 30,
  };
}
