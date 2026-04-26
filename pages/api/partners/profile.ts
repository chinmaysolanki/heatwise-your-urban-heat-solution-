import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import type { UpsertPartnerProfileInput } from "@/lib/partnerOperationsTypes";
import { getPartnerOperationsProfile, upsertPartnerOperationsProfile } from "@/lib/services/partnerProfileService";

import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method === "GET") {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;
    const iid = typeof req.query.installerId === "string" ? req.query.installerId.trim() : "";
    if (!iid) {
      return sendStructuredError(res, { code: "INVALID_QUERY", message: "installerId required" }, 400);
    }
    const out = await getPartnerOperationsProfile(iid);
    if (!out.ok) return sendStructuredError(res, out.error, 400);
    return res.status(200).json({ profile: out.profile });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET or POST" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<UpsertPartnerProfileInput>(req.body);
  if (!body?.installerId) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "installerId required" }, 400);
  }

  const out = await upsertPartnerOperationsProfile(body);
  if (!out.ok) {
    const status = out.error.code === "NOT_FOUND" ? 404 : 400;
    return sendStructuredError(res, out.error, status);
  }
  return res.status(200).json({ partnerOperationsProfileId: out.partnerOperationsProfileId });
}
