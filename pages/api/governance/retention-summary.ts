import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import type { UpsertRetentionCategoryInput } from "@/lib/governanceTypes";
import { getRetentionSummary, upsertRetentionCategoryPolicy } from "@/lib/services/retentionPolicyService";

import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method === "GET") {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;
    const summary = await getRetentionSummary();
    return res.status(200).json(summary);
  }

  if (req.method === "POST") {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;
    const body = readJsonBody<UpsertRetentionCategoryInput>(req.body);
    if (body?.entityCategory == null || body.defaultRetentionDays == null) {
      return sendStructuredError(
        res,
        { code: "INVALID_BODY", message: "entityCategory and defaultRetentionDays required" },
        400,
      );
    }
    const out = await upsertRetentionCategoryPolicy(body);
    if (!out.ok) return sendStructuredError(res, out.error, 400);
    return res.status(200).json({ id: out.id });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET or POST" } });
}
