import type { EnvironmentSnapshot } from "@prisma/client";

/** Client `environment` shape from HeatWiseApp (environment step). */
export type ClientEnvironment = {
  sunExposure?: string;
  windLevel?: string;
  summerTempC?: number;
};

export function clientEnvironmentToSnapshotFields(env: ClientEnvironment): {
  tempC: number | null;
  sunIndex: number | null;
  windIndex: number | null;
  shadeLevel: string | null;
} {
  const summerTempC =
    typeof env.summerTempC === "number" && Number.isFinite(env.summerTempC) ? env.summerTempC : null;
  const sun = String(env.sunExposure ?? "").toLowerCase();
  let sunIndex: number | null = null;
  let shadeLevel: string | null = null;
  if (sun === "shade") {
    sunIndex = 0.25;
    shadeLevel = "high_shade";
  } else if (sun === "partial") {
    sunIndex = 0.55;
    shadeLevel = "partial";
  } else if (sun === "full") {
    sunIndex = 0.9;
    shadeLevel = "full_sun";
  }

  const wind = String(env.windLevel ?? "").toLowerCase();
  let windIndex: number | null = null;
  if (wind === "low") windIndex = 0.33;
  else if (wind === "medium" || wind === "moderate") windIndex = 0.55;
  else if (wind === "high") windIndex = 0.9;

  return {
    tempC: summerTempC,
    sunIndex,
    windIndex,
    shadeLevel,
  };
}

export function environmentSnapshotToClientEnv(
  snap: Pick<EnvironmentSnapshot, "tempC" | "sunIndex" | "windIndex" | "shadeLevel">,
): ClientEnvironment {
  const out: ClientEnvironment = {};
  if (snap.tempC != null && Number.isFinite(snap.tempC)) {
    out.summerTempC = Math.round(snap.tempC);
  }
  if (snap.windIndex != null && Number.isFinite(snap.windIndex)) {
    if (snap.windIndex < 0.45) out.windLevel = "low";
    else if (snap.windIndex < 0.72) out.windLevel = "medium";
    else out.windLevel = "high";
  }
  if (snap.sunIndex != null && Number.isFinite(snap.sunIndex)) {
    if (snap.sunIndex < 0.4) out.sunExposure = "shade";
    else if (snap.sunIndex < 0.72) out.sunExposure = "partial";
    else out.sunExposure = "full";
  } else if (snap.shadeLevel) {
    const s = String(snap.shadeLevel).toLowerCase();
    if (s.includes("shade") && !s.includes("partial")) out.sunExposure = "shade";
    else if (s.includes("partial")) out.sunExposure = "partial";
    else if (s.includes("full")) out.sunExposure = "full";
  }
  return out;
}

export function isNonEmptyClientEnvironment(env: unknown): env is ClientEnvironment {
  if (!env || typeof env !== "object") return false;
  const o = env as Record<string, unknown>;
  return (
    o.sunExposure != null ||
    o.windLevel != null ||
    (typeof o.summerTempC === "number" && Number.isFinite(o.summerTempC))
  );
}
