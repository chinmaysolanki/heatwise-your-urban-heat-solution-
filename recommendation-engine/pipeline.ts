// ============================================================
// HeatWise — Recommendation Pipeline
// src/engine/pipeline.ts
//
// Orchestrates all pipeline stages in sequence:
//
//   1. computeGeometry      — derive spatial properties
//   2. generateAllCandidates — produce all possible layouts
//   3. filterCandidates     — remove invalid/unsafe ones
//   4. scoreCandidates      — multi-criteria scoring
//   5. rankAndExplain       — select top N + build explanations
//   6. generateLayoutSchema — attach positioned visual schema
//
// Each stage is isolated — no stage knows about any other.
// The pipeline is the only place that knows the order.
//
// Design guarantees:
//   - Fully deterministic: same input → same output every time
//   - Complete audit trail via pipelineLog
//   - Never throws: errors are caught and surfaced in result
//   - Always returns at least 1 recommendation (fallback logic)
// ============================================================

import type {
  ProjectInput,
  PipelineResult,
  PipelineLogEntry,
  ScoringWeights,
} from "@/models";

import { computeGeometry           } from "./geometry";
import { generateAllCandidates     } from "./candidateGenerator";
import { filterCandidates          } from "./constraintFilter";
import { scoreCandidates, DEFAULT_WEIGHTS } from "./scorer";
import { rankAndExplain            } from "./ranker";
import { generateLayoutSchema      } from "./layoutSchemaGenerator";

// ─── Public API ──────────────────────────────────────────────

export interface PipelineOptions {
  topN?:    number;          // how many recommendations to return (default: 3)
  weights?: ScoringWeights;  // custom scoring weights (default: DEFAULT_WEIGHTS)
}

/**
 * The single entry point for the entire recommendation system.
 *
 * Usage:
 *   const result = runPipeline(userInput);
 *   result.recommendations[0].explanation.summary  // top pick rationale
 *   result.recommendations[0].layoutSchema         // positioned blueprint
 *
 * @param input   Validated ProjectInput from the UI
 * @param options Optional: custom topN and scoring weights
 */
export function runPipeline(
  input:   ProjectInput,
  options: PipelineOptions = {},
): PipelineResult {
  const startTime = Date.now();
  const log: PipelineLogEntry[] = [];
  const { topN = 3, weights = DEFAULT_WEIGHTS } = options;

  log.push({ stage: "pipeline", message: "▶ Pipeline started", data: { input } });

  try {
    // ── Stage 1: Geometry ────────────────────────────────────
    const geometry = computeGeometry(input);

    log.push({
      stage:   "geometry",
      message: `Canvas ${input.widthM}×${input.lengthM}m — ` +
               `area=${geometry.areaSqM}m², ${geometry.isSmall ? "small" : geometry.isMedium ? "medium" : "large"}`,
      data: geometry,
    });

    // ── Stage 2: Generate Candidates ─────────────────────────
    const allCandidates = generateAllCandidates(input, geometry);

    log.push({
      stage:   "generate",
      message: `Generated ${allCandidates.length} candidate layouts from ${allCandidates.length} templates`,
    });

    // ── Stage 3: Filter ──────────────────────────────────────
    const filterResult = filterCandidates(allCandidates, input, geometry);
    log.push(...filterResult.log);
    log.push({
      stage:   "filter",
      message: `${filterResult.passed.length} passed, ${filterResult.rejected.length} rejected`,
      data: {
        passed:   filterResult.passed.map(c => c.template.name),
        rejected: filterResult.rejected.map(r => ({
          name:    r.candidate.template.name,
          reasons: r.reasons.map(r => r.rule),
        })),
      },
    });

    // ── Stage 4: Score ───────────────────────────────────────
    const scoredCandidates = scoreCandidates(
      filterResult.passed, input, geometry, weights,
    );

    const scoresSummary = scoredCandidates.map((c) => ({
      name:    c.template.name,
      total:   c.score.total,
      cooling: c.score.coolingEfficiency,
      cost:    c.score.costFit,
      maint:   c.score.maintenanceFit,
      goal:    c.score.goalAlignment,
    }));

    log.push({
      stage:   "score",
      message: `Scored ${scoredCandidates.length} candidates`,
      data:    scoresSummary,
    });

    // ── Stage 5: Rank + Explain ───────────────────────────────
    const recommendations = rankAndExplain(scoredCandidates, input, topN);

    log.push({
      stage:   "rank",
      message: `Top ${recommendations.length} selected`,
      data: recommendations.map((r) => ({
        rank:     r.rank,
        name:     r.candidate.template.name,
        score:    r.candidate.score.total,
        headline: r.explanation.headline,
      })),
    });

    // ── Stage 6: Layout Schema ────────────────────────────────
    for (const rec of recommendations) {
      rec.layoutSchema = generateLayoutSchema(rec, input, geometry);
    }

    log.push({
      stage:   "schema",
      message: `Layout schemas generated for all ${recommendations.length} recommendations`,
    });

    const durationMs = Date.now() - startTime;
    log.push({
      stage:   "pipeline",
      message: `✓ Pipeline complete in ${durationMs}ms`,
    });

    return {
      input,
      geometry,
      totalCandidates: allCandidates.length,
      filteredCount:   filterResult.rejected.length,
      recommendations,
      pipelineLog:     log,
      durationMs,
    };

  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);

    log.push({
      stage:   "pipeline",
      message: `✗ Pipeline error: ${message}`,
      data:    error,
    });

    // Return a minimal result so the caller can handle gracefully
    return {
      input,
      geometry:        computeGeometry(input),
      totalCandidates: 0,
      filteredCount:   0,
      recommendations: [],
      pipelineLog:     log,
      durationMs,
    };
  }
}

// ─── Convenience: Run with custom weights ────────────────────

/**
 * Pre-configured pipeline variant for users who emphasise budget.
 * Shifts 15% weight from cooling to cost.
 */
export function runBudgetFirstPipeline(input: ProjectInput): PipelineResult {
  return runPipeline(input, {
    weights: {
      coolingEfficiency: 0.20,
      costFit:           0.40,
      maintenanceFit:    0.20,
      goalAlignment:     0.20,
    },
  });
}

/**
 * Pre-configured pipeline variant for users who emphasise cooling.
 * Shifts weight heavily toward cooling efficiency.
 */
export function runCoolingFirstPipeline(input: ProjectInput): PipelineResult {
  return runPipeline(input, {
    weights: {
      coolingEfficiency: 0.55,
      costFit:           0.15,
      maintenanceFit:    0.15,
      goalAlignment:     0.15,
    },
  });
}
