-- Phase 6: link learning telemetry events to RecommendationRun for exports
ALTER TABLE "RecommendationTelemetryEvent" ADD COLUMN "recommendationRunId" TEXT;

CREATE INDEX "RecommendationTelemetryEvent_recommendationRunId_idx" ON "RecommendationTelemetryEvent"("recommendationRunId");
