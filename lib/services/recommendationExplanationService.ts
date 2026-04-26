import type { RuntimeCandidate } from "@/lib/ml/recommendationRuntimeTypes";

export type ExplainInput = {
  candidate: RuntimeCandidate;
  runExplanation?: Record<string, unknown>;
  telemetryMeta?: Record<string, unknown>;
};

/**
 * Normalizes explanation fields for API/UI (can be extended with localization or LLM later).
 */
export function buildStructuredExplanation(input: ExplainInput): {
  headline: string;
  bullets: string[];
  technical: {
    scores: RuntimeCandidate["scores"];
    telemetry?: Record<string, unknown>;
  };
} {
  const { candidate } = input;
  const bullets = candidate.explanation?.summaryBullets ?? [];
  const headline = candidate.blocked
    ? "This option is not offered (safety or policy)."
    : "Recommended green cooling approach for your space.";
  return {
    headline,
    bullets,
    technical: {
      scores: candidate.scores,
      telemetry: input.telemetryMeta,
    },
  };
}
