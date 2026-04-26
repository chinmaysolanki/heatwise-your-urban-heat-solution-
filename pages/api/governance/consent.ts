import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import type { UpsertConsentInput } from "@/lib/governanceTypes";
import { listUserConsents, upsertUserConsent } from "@/lib/services/consentService";

import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method === "GET") {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;
    const uid = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    if (!uid) {
      return sendStructuredError(res, { code: "INVALID_QUERY", message: "userId required" }, 400);
    }
    const out = await listUserConsents(uid);
    if (!out.ok) return sendStructuredError(res, out.error, 400);
    return res.status(200).json({ items: out.items });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET or POST" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<UpsertConsentInput>(req.body);
  if (!body?.userId || !body.consentScope || !body.consentStatus) {
    return sendStructuredError(
      res,
      { code: "INVALID_BODY", message: "userId, consentScope, consentStatus required" },
      400,
    );
  }

  const out = await upsertUserConsent(body);
  if (!out.ok) {
    const status = out.error.code === "NOT_FOUND" ? 404 : 400;
    return sendStructuredError(res, out.error, status);
  }
  return res.status(200).json({ userConsentRecordId: out.userConsentRecordId });
}
