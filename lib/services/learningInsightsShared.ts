import type { RecommendationTelemetrySession, RecommendationCandidateSnapshot } from "@prisma/client";

export type SegmentDimensions = {
  projectType: string | null;
  climateZone: string | null;
  budgetBand: string | null;
  region: string | null;
  userType: string;
  installerAvailabilityBand: string;
  personalizationConfidenceBand: string;
};

export function parseJsonObj(raw: string): Record<string, unknown> {
  try {
    const x = JSON.parse(raw) as unknown;
    return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function buildSegmentKey(d: SegmentDimensions): string {
  const parts = [
    `pt:${d.projectType ?? "unknown"}`,
    `cz:${d.climateZone ?? "unknown"}`,
    `bb:${d.budgetBand ?? "unknown"}`,
    `r:${d.region ?? "unknown"}`,
    `ut:${d.userType}`,
    `ia:${d.installerAvailabilityBand}`,
    `pc:${d.personalizationConfidenceBand}`,
  ];
  return parts.join("|");
}

export function extractSegmentDimensions(session: RecommendationTelemetrySession): SegmentDimensions {
  const p = parseJsonObj(session.projectSnapshotJson);
  const e = parseJsonObj(session.environmentSnapshotJson);
  const pref = parseJsonObj(session.preferenceSnapshotJson);

  const projectType =
    (typeof p.project_type === "string" && p.project_type) ||
    (typeof p.space_kind === "string" && p.space_kind) ||
    (typeof p.primaryGoal === "string" && p.primaryGoal) ||
    null;

  const climateZone =
    (typeof e.climate_zone === "string" && e.climate_zone) ||
    (typeof e.climateZone === "string" && e.climateZone) ||
    null;

  const budgetBand =
    (typeof pref.budget_band === "string" && pref.budget_band) ||
    (typeof pref.budgetBand === "number" && String(pref.budgetBand)) ||
    (typeof pref.budgetBand === "string" && pref.budgetBand) ||
    null;

  const region =
    (typeof e.region === "string" && e.region) ||
    (typeof p.location === "string" && String(p.location).split(",").pop()?.trim()) ||
    null;

  const userType = session.userId ? "registered" : "anonymous";

  const instAvail = e.installer_availability_band ?? e.installerAvailabilityBand;
  const installerAvailabilityBand =
    typeof instAvail === "string" && instAvail ? instAvail : "unknown";

  const pconf = pref.personalization_confidence ?? pref.personalizationConfidence;
  const personalizationConfidenceBand =
    typeof pconf === "string" && pconf ? pconf : "unknown";

  return {
    projectType,
    climateZone,
    budgetBand,
    region,
    userType,
    installerAvailabilityBand,
    personalizationConfidenceBand,
  };
}

export function primaryRecommendationType(
  candidates: RecommendationCandidateSnapshot[],
): string | null {
  const first = [...candidates].sort((a, b) => a.candidateRank - b.candidateRank)[0];
  if (!first) return null;
  const payload = parseJsonObj(first.candidatePayloadJson);
  const t = payload.recommendation_type ?? payload.recommendationType;
  return typeof t === "string" ? t : null;
}
