import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import type { CreateGovernanceReviewInput, UpdateGovernanceReviewInput } from "@/lib/governanceTypes";
import {
  createGovernanceReview,
  listGovernanceReviews,
  updateGovernanceReview,
} from "@/lib/services/governanceReviewService";

import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method === "GET") {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;
    const status = typeof req.query.status === "string" ? req.query.status.trim() : undefined;
    const limitRaw = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
    const { items } = await listGovernanceReviews({ status, limit: limitRaw });
    return res.status(200).json({ items });
  }

  if (req.method === "POST") {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;
    const body = readJsonBody<CreateGovernanceReviewInput>(req.body);
    if (!body?.reviewType || !body.subjectEntityType || !body.subjectEntityId) {
      return sendStructuredError(
        res,
        { code: "INVALID_BODY", message: "reviewType, subjectEntityType, subjectEntityId required" },
        400,
      );
    }
    const out = await createGovernanceReview(body);
    if (!out.ok) {
      const status = out.error.code === "NOT_FOUND" ? 404 : 400;
      return sendStructuredError(res, out.error, status);
    }
    return res.status(201).json({ governanceReviewRecordId: out.governanceReviewRecordId });
  }

  if (req.method === "PATCH") {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;
    const body = readJsonBody<UpdateGovernanceReviewInput>(req.body);
    if (!body?.reviewId) {
      return sendStructuredError(res, { code: "INVALID_BODY", message: "reviewId required" }, 400);
    }
    const out = await updateGovernanceReview(body);
    if (!out.ok) {
      const status = out.error.code === "NOT_FOUND" ? 404 : 400;
      return sendStructuredError(res, out.error, status);
    }
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PATCH");
  return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET, POST, or PATCH" } });
}
