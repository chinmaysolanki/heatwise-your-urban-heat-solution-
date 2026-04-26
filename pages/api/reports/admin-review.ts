import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import { getAdminReviewPayload } from "@/lib/services/adminReviewDossierService";

import { sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET only" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const id = typeof req.query.dossierId === "string" ? req.query.dossierId : null;
  if (!id) {
    return sendStructuredError(res, { code: "INVALID_QUERY", message: "dossierId required" }, 400);
  }

  const out = await getAdminReviewPayload(id);
  if (!out.ok) {
    return sendStructuredError(res, out.error, 404);
  }
  return res.status(200).json({
    scope: "admin",
    ...out.report,
    adminReviewDossier: out.adminReview,
  });
}
