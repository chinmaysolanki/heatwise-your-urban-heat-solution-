import type { EnrichmentWarning, RecommendationEnrichmentStatus } from "@/lib/ml/recommendationRuntimeTypes";

export type EnrichmentResponseMeta = {
  /**
   * True if any product enrichment phase (geo / supply / pricing) ended in `failed`.
   * Shadow-eval-only issues do not set this flag.
   */
  enrichmentDegraded: boolean;
  /**
   * True when the response is still usable but something non-fatal occurred: a phase failed,
   * a snapshot persist failed, or another warning was recorded for geo/supply/pricing.
   */
  enrichmentPartialSuccess: boolean;
};

export function buildEnrichmentResponseMeta(
  status: RecommendationEnrichmentStatus,
  warnings: EnrichmentWarning[],
): EnrichmentResponseMeta {
  const productFailed =
    status.geo === "failed" || status.supply === "failed" || status.pricing === "failed";
  const productWarnings = warnings.filter((w) => w.phase !== "shadow_eval");
  const enrichmentDegraded = productFailed;
  const enrichmentPartialSuccess = productFailed || productWarnings.length > 0;
  return { enrichmentDegraded, enrichmentPartialSuccess };
}
