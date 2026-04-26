import type { NextApiRequest, NextApiResponse } from "next";

import { readRecentRuntimeEvaluations } from "@/lib/services/recommendationEvaluationService";
import { sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET or POST" } });
  }

  let limit = 100;
  if (req.method === "GET") {
    const q = req.query.limit;
    if (typeof q === "string" && q.trim()) {
      const n = parseInt(q, 10);
      if (!Number.isFinite(n) || n < 1 || n > 2000) {
        return sendStructuredError(res, { code: "INVALID_QUERY", message: "limit must be 1–2000" }, 400);
      }
      limit = n;
    }
  } else {
    const body = req.body as { limit?: number } | null;
    if (body && typeof body.limit === "number") {
      if (!Number.isFinite(body.limit) || body.limit < 1 || body.limit > 2000) {
        return sendStructuredError(res, { code: "INVALID_BODY", message: "limit must be 1–2000" }, 400);
      }
      limit = body.limit;
    }
  }

  try {
    const rows = readRecentRuntimeEvaluations(limit);
    return res.status(200).json({ evaluations: rows, count: rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "read_error";
    return sendStructuredError(res, { code: "EVAL_READ_ERROR", message: msg }, 500);
  }
}
