import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import type { CapabilityMatchCriteria, UpsertPartnerCapabilityInput } from "@/lib/partnerOperationsTypes";
import {
  getPartnerCapabilityMatrix,
  matchPartnerCapabilities,
  upsertPartnerCapabilityMatrix,
} from "@/lib/services/partnerCapabilityService";

import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method === "GET") {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;
    const iid = typeof req.query.installerId === "string" ? req.query.installerId.trim() : "";
    if (!iid) {
      return sendStructuredError(res, { code: "INVALID_QUERY", message: "installerId required" }, 400);
    }

    const matchRaw = req.query.match;
    if (matchRaw === "1" || matchRaw === "true") {
      const criteria: CapabilityMatchCriteria = {
        projectType: typeof req.query.projectType === "string" ? req.query.projectType : undefined,
        solutionType: typeof req.query.solutionType === "string" ? req.query.solutionType : undefined,
        complexityBand: typeof req.query.complexityBand === "string" ? req.query.complexityBand : undefined,
      };
      const m = await matchPartnerCapabilities(iid, criteria);
      if (!m.ok) return sendStructuredError(res, m.error, 400);
      return res.status(200).json({ matches: m.matches, reasons: m.reasons });
    }

    const out = await getPartnerCapabilityMatrix(iid);
    if (!out.ok) return sendStructuredError(res, out.error, 400);
    return res.status(200).json({ matrix: out.matrix });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET or POST" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<UpsertPartnerCapabilityInput>(req.body);
  if (!body?.installerId) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "installerId required" }, 400);
  }

  const out = await upsertPartnerCapabilityMatrix(body);
  if (!out.ok) {
    const status = out.error.code === "NOT_FOUND" ? 404 : 400;
    return sendStructuredError(res, out.error, status);
  }
  return res.status(200).json({ partnerCapabilityMatrixId: out.partnerCapabilityMatrixId });
}
