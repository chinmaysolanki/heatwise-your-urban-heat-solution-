import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import type { PricingEvalContext } from "@/lib/ml/pricingTypes";
import { areaSqmFromProject } from "@/lib/services/pricingEstimateService";
import {
  buildSupplyConstraintsPayload,
  resolveClimateZone,
  resolveProjectType,
  resolveSupplyRegion,
} from "@/lib/services/recommendationConstraintService";

import { readJsonBody, sendStructuredError } from "../recommendations/_utils";

type Body = {
  project: Record<string, unknown>;
  environment: Record<string, unknown>;
  preferences: Record<string, unknown>;
  evaluationContext?: PricingEvalContext | null;
};

/**
 * Admin/ops: compact view of pricing context (region, area interpretation, supply snapshot summary).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<Body>(req.body);
  if (!body?.project || !body.environment || !body.preferences) {
    return sendStructuredError(
      res,
      { code: "INVALID_BODY", message: "project, environment, preferences required" },
      400,
    );
  }

  const region = resolveSupplyRegion(body.project, body.environment, body.evaluationContext as never);
  const climateZone = resolveClimateZone(body.environment, body.evaluationContext as never);
  const projectType = resolveProjectType(body.project);
  const sqm = areaSqmFromProject(body.project);

  let supplySummary: Record<string, unknown> | null = null;
  try {
    const sc = await buildSupplyConstraintsPayload({
      project: body.project,
      environment: body.environment,
      preferences: body.preferences,
      evaluationContext: body.evaluationContext as never,
    });
    if (sc) {
      supplySummary = {
        readiness: sc.readiness,
        deferInstallSuggested: sc.deferInstallSuggested,
        blockedSpeciesCount: sc.blockedSpecies.length,
        globalSoftMultiplier: sc.globalSoftMultiplier,
      };
    }
  } catch {
    supplySummary = null;
  }

  return res.status(200).json({
    pricingRulesVersion: "hw-pricing-rules-v1.0",
    resolvedContext: { region, climateZone, projectType, areaSqmInterpreted: sqm },
    supplySummary,
    notes: [
      "Heuristic v1 uses area^0.82 scaling, solution multipliers, and optional supply widening.",
      "Set HEATWISE_PRICING_USE_QUOTE_BENCHMARK=1 on generate to blend regional quote medians.",
    ],
  });
}
