/**
 * Offline smoke: generate → create-session → quote → dossier → user report (service layer).
 *
 * Requires DATABASE_URL, `npm run demo:setup` (or demo:seed), and:
 *   HEATWISE_DEMO_USER_ID   (from seed output)
 *   HEATWISE_DEMO_PROJECT_ROOFTOP_ID
 *
 * Exit 0 prints PASS; non-zero on failure.
 */

import { buildDemoUserReport } from "@/lib/demoPresentation";
import { db } from "@/lib/db";
import { generateRecommendationsRuntime } from "@/lib/services/mlRecommendationService";
import { assembleAndPersistRecommendationDossier } from "@/lib/services/recommendationDossierService";
import { createRecommendationSession } from "@/lib/services/recommendationTelemetryService";
import { createQuoteRequest } from "@/lib/services/quoteWorkflowService";
import { getUserReportPayload } from "@/lib/services/userReportService";

function requireEnv(name: string): string {
  const v = (process.env[name] ?? "").trim();
  if (!v) {
    console.error(`[demo-smoke] Missing ${name}`);
    process.exit(2);
  }
  return v;
}

async function main(): Promise<void> {
  const projectId = requireEnv("HEATWISE_DEMO_PROJECT_ROOFTOP_ID");
  const userId = requireEnv("HEATWISE_DEMO_USER_ID");

  const projRow = await db.project.findUnique({ where: { id: projectId } });
  if (!projRow || projRow.userId !== userId) {
    console.error("[demo-smoke] Project not found or user does not own project.");
    process.exit(2);
  }

  const project: Record<string, unknown> = {
    id: projRow.id,
    name: projRow.name,
    location: projRow.location,
    surfaceType: projRow.surfaceType,
    primaryGoal: projRow.primaryGoal,
    area: projRow.area,
    budget_inr: 150_000,
  };
  const environment: Record<string, unknown> = {
    city: "Bengaluru",
    region: "KA",
    sunlight_hours: 6,
    shade_level: "partial",
    drainage_quality: "good",
    water_availability: "good",
  };
  const preferences: Record<string, unknown> = {
    budget_inr: 150_000,
    maintenance_level: "moderate",
  };

  const genReq = {
    project,
    environment,
    preferences,
    projectId,
    userId,
    maxCandidates: 3,
    skipGeoEnrichment: true,
    skipSupplyConstraints: true,
    skipPricingEnrichment: true,
  };

  const out = await generateRecommendationsRuntime(genReq);
  if (!out.candidates?.length) {
    console.error("[demo-smoke] FAIL: no candidates from generate");
    process.exit(1);
  }

  const modelVersion =
    [out.telemetryMeta.modelVersionFeasibility, out.telemetryMeta.modelVersionHeat, out.telemetryMeta.modelVersionRanking]
      .filter(Boolean)
      .join("/") || "rules_or_unversioned";

  const genSrc =
    typeof out.telemetryMeta.generatorSource === "string" && out.telemetryMeta.generatorSource.trim()
      ? out.telemetryMeta.generatorSource.trim()
      : out.mode === "rules_only"
        ? "live_rules"
        : "ml_ranker";

  const sessionIn = {
    projectId,
    userId,
    modelVersion,
    rulesVersion: out.telemetryMeta.rulesVersion,
    generatorSource: genSrc,
    projectSnapshot: project,
    environmentSnapshot: environment,
    preferenceSnapshot: preferences,
    totalCandidates: out.candidates.length,
    latencyMs: 1,
    idempotencyKey: `demo-smoke-session-${projectId}-${Date.now()}`,
    candidates: out.candidates.map((c) => ({
      candidateRank: c.rank,
      candidateScore: c.scores.blended,
      candidateSource: genSrc,
      candidatePayload: c.candidatePayload,
    })),
  };

  const sess = await createRecommendationSession(sessionIn);
  if (!sess.ok) {
    console.error("[demo-smoke] FAIL: create-session", sess.error);
    process.exit(1);
  }

  const recommendationSessionId = sess.data.recommendationSessionId;
  const candidateSnapshotIds = sess.data.candidateSnapshotIds;
  const snapId = candidateSnapshotIds[0];

  const quote = await createQuoteRequest({
    projectId,
    userId,
    recommendationSessionId,
    selectedCandidateSnapshotId: snapId,
    userLocationRegion: "IN-KA",
    projectSnapshot: project,
    candidateSnapshot: out.candidates[0]?.candidatePayload ?? {},
    idempotencyKey: `demo-smoke-quote-${recommendationSessionId}`,
  });
  if (!quote.ok) {
    console.error("[demo-smoke] FAIL: quote", quote.error);
    process.exit(1);
  }

  const dossier = await assembleAndPersistRecommendationDossier({
    recommendationSessionId,
    dossierType: "user_final_recommendation",
    userId,
    selectedCandidateSnapshotId: snapId,
  });
  if (!dossier.ok) {
    console.error("[demo-smoke] FAIL: dossier", dossier.error);
    process.exit(1);
  }

  const report = await getUserReportPayload(dossier.recommendationDossierId);
  if (!report.ok) {
    console.error("[demo-smoke] FAIL: user report", report.error);
    process.exit(1);
  }

  const demo = buildDemoUserReport(report.report);
  if (!demo.projectSummary && !demo.recommendationOverview) {
    console.error("[demo-smoke] FAIL: empty demo report summary");
    process.exit(1);
  }

  console.log("PASS — demo smoke OK");
  console.log(
    JSON.stringify(
      {
        recommendationSessionId,
        quoteRequestId: quote.quoteRequestId,
        recommendationDossierId: dossier.recommendationDossierId,
        candidateRank1SnapshotId: snapId,
        generateMode: out.mode,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error("[demo-smoke] FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
