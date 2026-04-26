import { createHash } from "crypto";

import type { NextApiRequest } from "next";

import type { RecommendationGenerateRequest } from "@/lib/ml/recommendationRuntimeTypes";

export type TrafficChannel = "canonical" | "shadow_experiment" | "compat_client";

/**
 * Stable hash for dedupe: project/session ids + coarse project/prefs slices (not full env — avoids noise).
 */
export function computeRecommendationRuntimeFingerprint(
  body: RecommendationGenerateRequest | null | undefined,
  assignmentKey?: string | null,
): string {
  if (!body?.project || !body.environment || !body.preferences) {
    const basis = `invalid|${assignmentKey ?? ""}`;
    return createHash("sha256").update(basis).digest("hex").slice(0, 32);
  }
  const p = body.project as Record<string, unknown>;
  const e = body.environment as Record<string, unknown>;
  const pref = body.preferences as Record<string, unknown>;
  const stable = {
    projectId: body.projectId ?? null,
    photoSessionId: body.photoSessionId ?? null,
    userId: body.userId ?? null,
    assignmentKey: assignmentKey ?? null,
    budget: p.budget_inr ?? p.budgetInr ?? null,
    projectType: p.project_type ?? p.space_kind ?? p.projectType ?? null,
    floor: p.floor_level ?? p.floorLevel ?? null,
    purpose: pref.purpose_primary ?? pref.purposePrimary ?? null,
    maintenance: pref.maintenanceLevel ?? pref.maintenance_level ?? null,
    sun: e.sunExposure ?? e.sun_exposure ?? null,
    maxCandidates: body.maxCandidates ?? null,
    rulesVersion: body.rulesVersion ?? null,
  };
  const json = JSON.stringify(stable, Object.keys(stable).sort());
  return createHash("sha256").update(json).digest("hex").slice(0, 32);
}

export function resolveRecommendationTrafficChannel(
  req: NextApiRequest,
  shadowEvalEnabled: boolean,
  hasEvaluationContext: boolean,
): TrafficChannel {
  const hdr = String(req.headers["x-heatwise-runtime-channel"] ?? "").toLowerCase();
  if (hdr === "compat" || hdr === "compat_client") return "compat_client";
  const q = req.query.compat;
  if (typeof q === "string" && (q === "1" || q === "true")) return "compat_client";

  if (shadowEvalEnabled && hasEvaluationContext) return "shadow_experiment";
  return "canonical";
}

export function recommendationRuntimeDedupeWindowMs(): number {
  const raw = process.env.HEATWISE_RUNTIME_OBS_DEDUPE_WINDOW_MS?.trim();
  if (!raw) return 120_000;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 120_000;
}
