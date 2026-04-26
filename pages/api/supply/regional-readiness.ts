import type { NextApiRequest, NextApiResponse } from "next";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { hasValidOpsToken, requireOpsOrAdmin } from "@/lib/opsAuth";
import { listRegionalReadiness, recomputeRegionalReadinessForSolution } from "@/lib/services/regionalReadinessService";

import { readJsonBody, sendStructuredError } from "../recommendations/_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method === "GET") {
    const session = await getServerSession(req, res, authOptions as NextAuthOptions);
    if (!session && !hasValidOpsToken(req)) {
      return sendStructuredError(res, { code: "UNAUTHORIZED", message: "Session or ops token required" }, 401);
    }
    const region = String(req.query.region ?? "").trim();
    if (!region) {
      return sendStructuredError(res, { code: "INVALID_QUERY", message: "region required" }, 400);
    }
    const projectType =
      typeof req.query.projectType === "string" && req.query.projectType.trim()
        ? req.query.projectType.trim()
        : undefined;
    const rows = await listRegionalReadiness(region, projectType);
    return res.status(200).json({ items: rows });
  }

  if (req.method === "POST") {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;
    const body = readJsonBody<{ region: string; projectType: string; solutionType: string }>(req.body);
    if (!body?.region || !body.projectType || !body.solutionType) {
      return sendStructuredError(
        res,
        { code: "INVALID_BODY", message: "region, projectType, solutionType required" },
        400,
      );
    }
    await recomputeRegionalReadinessForSolution(body);
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET or POST" } });
}
