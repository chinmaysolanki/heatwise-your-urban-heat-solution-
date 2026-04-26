import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import type { UpsertFieldOpsStatusInput } from "@/lib/partnerOperationsTypes";
import {
  aggregateFieldOpsSummary,
  getPartnerFieldOpsStatus,
  upsertPartnerFieldOpsStatus,
} from "@/lib/services/fieldOpsStatusService";

import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method === "GET") {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;

    const agg = req.query.aggregate;
    if (agg === "1" || agg === "true") {
      const summary = await aggregateFieldOpsSummary();
      return res.status(200).json({ aggregate: summary });
    }

    const iid = typeof req.query.installerId === "string" ? req.query.installerId.trim() : "";
    if (!iid) {
      return sendStructuredError(
        res,
        { code: "INVALID_QUERY", message: "installerId required (or aggregate=1)" },
        400,
      );
    }
    const out = await getPartnerFieldOpsStatus(iid);
    if (!out.ok) return sendStructuredError(res, out.error, 400);
    return res.status(200).json({ status: out.status });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET or POST" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<UpsertFieldOpsStatusInput>(req.body);
  if (!body?.installerId) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "installerId required" }, 400);
  }

  const out = await upsertPartnerFieldOpsStatus(body);
  if (!out.ok) {
    const status = out.error.code === "NOT_FOUND" ? 404 : 400;
    return sendStructuredError(res, out.error, status);
  }
  return res.status(200).json({ partnerFieldOpsStatusId: out.partnerFieldOpsStatusId });
}
