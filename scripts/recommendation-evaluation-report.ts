/**
 * Run fixed recommendation scenarios through POST /api/recommendations/generate (in-process)
 * and write JSON + Markdown + CSV evaluation artifacts.
 *
 * Usage (from heatwise/):
 *   npx tsx scripts/recommendation-evaluation-report.ts
 *   npx tsx scripts/recommendation-evaluation-report.ts --out reports/recommendation-eval
 *
 * Uses the same failing-Python stub as API E2E tests so runtime path is deterministic locally.
 */

import fs from "node:fs";
import path from "node:path";

import type { RecommendationGenerateRequest } from "@/lib/ml/recommendationRuntimeTypes";
import {
  invokeRecommendationsGenerate,
  createFailingPythonStub,
  createMockResponse,
  createPostRequest,
} from "@/lib/recommendation/testing/api/invokeRecommendationsGenerate";
import {
  evaluationReportToCsv,
  evaluationReportToMarkdown,
  summarizeRecommendationResponse,
  type EvaluationReportPayload,
} from "@/lib/recommendation/testing/evaluationReport";
import { RECOMMENDATION_TEST_SCENARIOS } from "@/lib/recommendation/testing/scenarios";
import generateHandler from "@/pages/api/recommendations/generate";

function parseOutDir(argv: string[]): string {
  const i = argv.indexOf("--out");
  if (i >= 0 && argv[i + 1]) return path.resolve(argv[i + 1]!);
  return path.resolve(process.cwd(), "reports", "recommendation-eval");
}

function withFastSkips(req: RecommendationGenerateRequest): RecommendationGenerateRequest {
  return {
    ...req,
    skipGeoEnrichment: true,
    skipSupplyConstraints: true,
    skipPricingEnrichment: true,
  };
}

async function main(): Promise<void> {
  const outDir = parseOutDir(process.argv.slice(2));
  fs.mkdirSync(outDir, { recursive: true });

  const prevPy = process.env.HEATWISE_ML_PYTHON;
  const stub = createFailingPythonStub();
  process.env.HEATWISE_ML_PYTHON = stub.executablePath;

  const rows: EvaluationReportPayload["rows"] = [];

  try {
    for (const scenario of RECOMMENDATION_TEST_SCENARIOS) {
      const res = createMockResponse();
      const { statusCode, body } = await invokeRecommendationsGenerate(
        createPostRequest(withFastSkips(scenario.request)),
        res,
        generateHandler,
      );
      rows.push(
        summarizeRecommendationResponse({
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          httpStatus: statusCode,
          body,
        }),
      );
    }
  } finally {
    stub.cleanup();
    if (prevPy === undefined) delete process.env.HEATWISE_ML_PYTHON;
    else process.env.HEATWISE_ML_PYTHON = prevPy;
  }

  const payload: EvaluationReportPayload = {
    schema_version: "heatwise.recommendation_eval.v1",
    generated_at: new Date().toISOString(),
    python_stubbed: true,
    rows,
  };

  const jsonPath = path.join(outDir, "recommendation-eval.json");
  const mdPath = path.join(outDir, "recommendation-eval.md");
  const csvPath = path.join(outDir, "recommendation-eval.csv");

  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdPath, evaluationReportToMarkdown(payload), "utf8");
  fs.writeFileSync(csvPath, evaluationReportToCsv(payload), "utf8");

  console.log(`Wrote:
  ${jsonPath}
  ${mdPath}
  ${csvPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
