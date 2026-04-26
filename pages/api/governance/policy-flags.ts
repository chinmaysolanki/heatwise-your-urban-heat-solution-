import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import type { CreatePolicyFlagInput, UpdatePolicyFlagInput } from "@/lib/governanceTypes";
import {
  createGovernancePolicyFlag,
  listGovernancePolicyFlags,
  updateGovernancePolicyFlag,
} from "@/lib/services/policyFlagService";

import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method === "GET") {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;
    const status = typeof req.query.status === "string" ? req.query.status.trim() : undefined;
    const limitRaw = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
    const { items } = await listGovernancePolicyFlags({ status, limit: limitRaw });
    return res.status(200).json({ items });
  }

  if (req.method === "POST") {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;
    const body = readJsonBody<CreatePolicyFlagInput>(req.body);
    if (!body?.flagType || !body.severity || !body.title) {
      return sendStructuredError(
        res,
        { code: "INVALID_BODY", message: "flagType, severity, title required" },
        400,
      );
    }
    const out = await createGovernancePolicyFlag(body);
    if (!out.ok) {
      const status = out.error.code === "NOT_FOUND" ? 404 : 400;
      return sendStructuredError(res, out.error, status);
    }
    return res.status(201).json({ governancePolicyFlagId: out.governancePolicyFlagId });
  }

  if (req.method === "PATCH") {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;
    const body = readJsonBody<UpdatePolicyFlagInput>(req.body);
    if (!body?.flagId) {
      return sendStructuredError(res, { code: "INVALID_BODY", message: "flagId required" }, 400);
    }
    const out = await updateGovernancePolicyFlag(body);
    if (!out.ok) {
      const status = out.error.code === "NOT_FOUND" ? 404 : 400;
      return sendStructuredError(res, out.error, status);
    }
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PATCH");
  return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET, POST, or PATCH" } });
}
