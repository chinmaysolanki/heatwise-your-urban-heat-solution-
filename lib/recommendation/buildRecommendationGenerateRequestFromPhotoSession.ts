import type { ProjectInput } from "@/models";
import type {
  RecommendationGenerateRequest,
  RecommendationGenerateResponse,
} from "@/lib/ml/recommendationRuntimeTypes";
import type { Recommendation } from "@/models";
import { projectInputToMlRequest } from "@/lib/recommendation/projectInputToMlRequest";

export { getLayoutEligibility } from "@/lib/recommendation/layoutEligibility";

/**
 * Photo session subset used to build the canonical POST /api/recommendations/generate body.
 * Kept aligned with `buildProjectInputFromPhotoSession` in HeatWiseApp.jsx.
 */
export type EnvironmentSnapshot = {
  // Existing manual fields
  sunExposure?: string;
  windLevel?: string;
  summerTempC?: number;
  // Auto-detected fields
  latitude?: number | null;
  longitude?: number | null;
  locationLabel?: string | null;
  currentTempC?: number | null;
  dailyMaxTempC?: number | null;
  windSpeedKmh?: number | null;
  uvIndex?: number | null;
  /** Derived heat level from daily max temp */
  heatExposure?: "low" | "medium" | "high" | "extreme" | null;
  /** Derived wind level from wind speed km/h */
  windExposure?: "sheltered" | "moderate" | "windy" | "severe" | null;
  /** User-selected space type */
  spaceType?: "indoor" | "outdoor_balcony" | "outdoor_terrace" | "outdoor_rooftop" | "semi_outdoor" | null;
  /** "auto" when values came from geolocation + weather API; "manual" when user typed/slid values */
  environmentSource?: "auto" | "manual" | null;
};

export type PhotoSessionForGenerate = {
  projectId?: string | null;
  id?: string | null;
  widthM?: number | null;
  lengthM?: number | null;
  floorLevel?: number | null;
  projectMeta?: {
    surfaceType?: string;
    primaryGoal?: string;
    name?: string;
    location?: string;
  } | null;
  environment?: EnvironmentSnapshot | null;
};

/** Map the extended spaceType string to the ProjectInput "rooftop"|"terrace"|"balcony" enum. */
function mapSpaceType(
  envSpaceType: EnvironmentSnapshot["spaceType"],
  metaSurfaceType: string | undefined,
): ProjectInput["spaceType"] {
  const src = (envSpaceType ?? metaSurfaceType ?? "rooftop").toLowerCase();
  if (src === "outdoor_balcony" || src === "balcony") return "balcony";
  if (src === "outdoor_terrace" || src === "terrace" || src === "semi_outdoor") return "terrace";
  return "rooftop"; // outdoor_rooftop, indoor (rooftop is closest supported), unknown
}

export function photoSessionLikeToProjectInput(ps: PhotoSessionForGenerate): ProjectInput {
  const w = ps.widthM ?? 6;
  const l = ps.lengthM ?? 7;
  const floor = ps.floorLevel ?? 1;
  const meta = ps.projectMeta ?? {};
  const env = ps.environment ?? {};

  const spaceType = mapSpaceType(env.spaceType, meta.surfaceType);

  const goalKey = String(meta.primaryGoal ?? "cooling").toLowerCase();
  const primaryGoal: ProjectInput["primaryGoal"] = goalKey === "cooling" ? "cooling" : "mixed";

  // Prefer auto-detected sunExposure (from heatExposure → UV derivation) over manual slider
  let sunExposure: ProjectInput["sunExposure"];
  if (env.sunExposure) {
    const r = String(env.sunExposure).toLowerCase();
    sunExposure = r === "shade" || r === "shaded" ? "shade" : r === "partial" ? "partial" : "full";
  } else if (env.heatExposure) {
    // Fallback: derive from heatExposure when sunExposure not set
    sunExposure = env.heatExposure === "low" ? "shade" : env.heatExposure === "medium" ? "partial" : "full";
  } else {
    sunExposure = "full";
  }

  // Prefer auto-detected windLevel (from windExposure) over manual slider
  let windLevel: ProjectInput["windLevel"];
  if (env.windLevel) {
    const r = String(env.windLevel).toLowerCase();
    windLevel = r === "low" ? "low" : r === "high" ? "high" : "medium";
  } else if (env.windExposure) {
    windLevel = env.windExposure === "sheltered" ? "low" : env.windExposure === "windy" || env.windExposure === "severe" ? "high" : "medium";
  } else {
    windLevel = "medium";
  }

  return {
    spaceType,
    widthM: w,
    lengthM: l,
    floorLevel: floor,
    sunExposure,
    windLevel,
    waterAccess: true,
    budgetRange: "medium",
    maintenanceLevel: "moderate",
    primaryGoal,
    ...(typeof env.latitude === "number" ? { latitude: env.latitude } : {}),
    ...(typeof env.longitude === "number" ? { longitude: env.longitude } : {}),
  };
}

/**
 * Canonical recommendation request body for the main app (rules + ML + optional layout attachment on server).
 */
export function buildRecommendationGenerateRequestFromPhotoSession(
  ps: PhotoSessionForGenerate,
  opts: { userId?: string | null } = {},
): RecommendationGenerateRequest {
  const input = photoSessionLikeToProjectInput(ps);
  const base = projectInputToMlRequest(input, {
    projectId: ps.projectId ?? undefined,
    maxCandidates: 8,
  });
  const env = ps.environment ?? {};
  const summerTempC =
    typeof env.summerTempC === "number" && Number.isFinite(env.summerTempC) ? env.summerTempC : undefined;
  const dailyMaxTempC =
    typeof env.dailyMaxTempC === "number" && Number.isFinite(env.dailyMaxTempC) ? env.dailyMaxTempC : undefined;
  return {
    ...base,
    projectId: ps.projectId ?? undefined,
    photoSessionId: typeof ps.id === "string" && ps.id.length > 0 ? ps.id : undefined,
    userId: opts.userId ?? undefined,
    project: {
      ...base.project,
      ...(ps.projectMeta?.name ? { name: ps.projectMeta.name } : {}),
      ...(ps.projectMeta?.location ? { location: ps.projectMeta.location, city: ps.projectMeta.location } : {}),
      // Extended space type for filtering (full string, not coarsened enum)
      ...(env.spaceType ? { space_type: env.spaceType } : {}),
    },
    environment: {
      ...base.environment,
      ...(summerTempC != null ? { summerTempC, summer_temp_c: summerTempC } : {}),
      // Auto-detected live weather signals
      ...(dailyMaxTempC != null ? { daily_max_temp_c: dailyMaxTempC } : {}),
      ...(env.heatExposure ? { heat_exposure: env.heatExposure } : {}),
      ...(env.windExposure ? { wind_exposure: env.windExposure } : {}),
      ...(typeof env.windSpeedKmh === "number" ? { wind_speed_kmh: env.windSpeedKmh } : {}),
      ...(typeof env.uvIndex === "number" ? { uv_index: env.uvIndex } : {}),
      ...(env.locationLabel ? { location_label: env.locationLabel } : {}),
      ...(env.environmentSource ? { environment_source: env.environmentSource } : {}),
    },
  };
}

/**
 * Layout slate from canonical generate: TS pipeline + spatial/heat enrichments (not raw `candidates`).
 * Inspect `layoutSlate` on the same JSON for eligibility / failure codes (Phase 4).
 */
export function layoutRecommendationsFromGenerateResponse(data: unknown): Recommendation[] {
  if (!data || typeof data !== "object") return [];
  const lg = (data as RecommendationGenerateResponse).layoutGeneration;
  if (lg?.recommendations?.length) return lg.recommendations;
  return [];
}

/**
 * Legacy POST /api/generate-layout body (ProjectInput + linkage).
 * Used only when `/api/recommendations/generate` returns no `layoutGeneration` (Phase 3 compat).
 */
export function buildGenerateLayoutRequestBody(ps: PhotoSessionForGenerate): Record<string, unknown> {
  const input = photoSessionLikeToProjectInput(ps);
  return {
    ...input,
    projectId: ps.projectId ?? null,
    photoSessionId: typeof ps.id === "string" ? ps.id : null,
  };
}
