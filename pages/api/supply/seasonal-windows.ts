import type { NextApiRequest, NextApiResponse } from "next";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasValidOpsToken, requireOpsOrAdmin } from "@/lib/opsAuth";
import { listSeasonalWindows } from "@/lib/services/seasonalConstraintService";

import { readJsonBody, sendStructuredError } from "../recommendations/_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method === "GET") {
    const session = await getServerSession(req, res, authOptions as NextAuthOptions);
    if (!session && !hasValidOpsToken(req)) {
      return sendStructuredError(res, { code: "UNAUTHORIZED", message: "Session or ops token required" }, 401);
    }
    const region = String(req.query.region ?? "").trim();
    const climateZone = String(req.query.climateZone ?? "").trim();
    if (!region || !climateZone) {
      return sendStructuredError(res, { code: "INVALID_QUERY", message: "region and climateZone required" }, 400);
    }
    const projectType =
      typeof req.query.projectType === "string" && req.query.projectType.trim()
        ? req.query.projectType.trim()
        : undefined;
    const rows = await listSeasonalWindows({ region, climateZone, projectType });
    return res.status(200).json({ items: rows });
  }

  if (req.method === "POST") {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;
    const body = readJsonBody<Prisma.SeasonalWindowCreateInput>(req.body);
    if (!body?.region || !body.climateZone) {
      return sendStructuredError(res, { code: "INVALID_BODY", message: "region and climateZone required" }, 400);
    }
    const row = await db.seasonalWindow.create({ data: body });
    return res.status(201).json(row);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET or POST" } });
}
