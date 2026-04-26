import fs from "node:fs";
import path from "node:path";

import { db } from "@/lib/db";

import { PLATFORM_SUBSYSTEMS } from "@/lib/platformHardeningConstants";
import type { ReadinessAggregateResponse, ReadinessCheckResult } from "@/lib/platformHardeningTypes";

async function timed(name: string, subsystem: string, fn: () => Promise<ReadinessCheckResult>): Promise<ReadinessCheckResult> {
  const t0 = Date.now();
  try {
    const r = await fn();
    return { ...r, latency_ms: Date.now() - t0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      check_id: name,
      subsystem,
      status: "fail",
      latency_ms: Date.now() - t0,
      message: msg.slice(0, 500),
      details: { error: "check_threw" },
    };
  }
}

function registryDir(): string {
  return process.env.HEATWISE_REGISTRY_DIR ?? path.join(process.cwd(), "ml/evaluation/data/empty_registry");
}

/**
 * Lightweight liveness/deep checks for major subsystems (incremental; safe to call from ops dashboards).
 */
export async function runPlatformReadinessChecks(): Promise<ReadinessAggregateResponse> {
  const checks: ReadinessCheckResult[] = [];

  checks.push(
    await timed("recommendation_runtime.sessions", "recommendation_runtime", async () => {
      await db.$queryRaw`SELECT 1`;
      const n = await db.recommendationTelemetrySession.count();
      return {
        check_id: "recommendation_runtime.sessions",
        subsystem: "recommendation_runtime",
        status: n >= 0 ? "pass" : "unknown",
        latency_ms: 0,
        message: `telemetry_sessions=${n}`,
        details: { count: n },
      };
    }),
  );

  checks.push(
    await timed("pricing.cost_estimates", "pricing", async () => {
      const n = await db.costEstimateSnapshot.count();
      return {
        check_id: "pricing.cost_estimates",
        subsystem: "pricing",
        status: "pass",
        latency_ms: 0,
        message: `cost_estimate_snapshots=${n}`,
        details: { count: n },
      };
    }),
  );

  checks.push(
    await timed("supply.species_availability", "supply", async () => {
      const n = await db.speciesAvailability.count();
      return {
        check_id: "supply.species_availability",
        subsystem: "supply",
        status: "pass",
        latency_ms: 0,
        message: `species_availability_rows=${n}`,
        details: { count: n },
      };
    }),
  );

  checks.push(
    await timed("installer_ops.jobs", "installer_ops", async () => {
      const n = await db.installerInstallJob.count();
      return {
        check_id: "installer_ops.jobs",
        subsystem: "installer_ops",
        status: "pass",
        latency_ms: 0,
        message: `installer_install_jobs=${n}`,
        details: { count: n },
      };
    }),
  );

  checks.push(
    await timed("reporting.dossiers", "reporting", async () => {
      const n = await db.recommendationDossier.count();
      return {
        check_id: "reporting.dossiers",
        subsystem: "reporting",
        status: "pass",
        latency_ms: 0,
        message: `recommendation_dossiers=${n}`,
        details: { count: n },
      };
    }),
  );

  checks.push(
    await timed("retraining_registry.path", "retraining_registry", async () => {
      const dir = registryDir();
      const ok = fs.existsSync(dir);
      return {
        check_id: "retraining_registry.path",
        subsystem: "retraining_registry",
        status: ok ? "pass" : "fail",
        latency_ms: 0,
        message: ok ? `registry_dir_ok path=${dir}` : `missing_registry_dir path=${dir}`,
        details: { path: dir },
      };
    }),
  );

  checks.push(
    await timed("integrations.events", "integrations", async () => {
      const n = await db.integrationEvent.count();
      return {
        check_id: "integrations.events",
        subsystem: "integrations",
        status: "pass",
        latency_ms: 0,
        message: `integration_events=${n}`,
        details: { count: n },
      };
    }),
  );

  checks.push(
    await timed("analytics.segment_performance", "analytics", async () => {
      const n = await db.segmentPerformance.count();
      return {
        check_id: "analytics.segment_performance",
        subsystem: "analytics",
        status: "pass",
        latency_ms: 0,
        message: `segment_performance_rows=${n}`,
        details: { count: n },
      };
    }),
  );

  const hasFail = checks.some((c) => c.status === "fail");
  const hasDegraded = checks.some((c) => c.status === "degraded");
  let overall: ReadinessAggregateResponse["overall"] = "healthy";
  if (hasFail) overall = "unhealthy";
  else if (hasDegraded) overall = "degraded";
  else if (checks.some((c) => c.status === "unknown")) overall = "unknown";

  return {
    overall,
    generated_at: new Date().toISOString(),
    checks,
  };
}

export function listReadinessSubsystemNames(): readonly string[] {
  return PLATFORM_SUBSYSTEMS;
}
