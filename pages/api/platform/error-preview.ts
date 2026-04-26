import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import {
  contractToStructuredError,
  httpStatusFromContract,
  normalizeStructuredErrorContract,
} from "@/lib/services/structuredErrorService";

import { readJsonBody, sendStructuredError } from "./_utils";

type Body = { error?: unknown };

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<Body>(req.body);
  if (!body || body.error === undefined) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "error object required" }, 400);
  }

  const normalized = normalizeStructuredErrorContract(body.error);
  if (!normalized.ok) {
    return sendStructuredError(res, normalized.error, 400);
  }

  const legacy = contractToStructuredError(normalized.normalized);
  const suggestedStatus = httpStatusFromContract(normalized.normalized);

  return res.status(200).json({
    normalized: normalized.normalized,
    legacy_structured_error: legacy,
    suggested_http_status: suggestedStatus,
    warnings: normalized.warnings,
  });
}
