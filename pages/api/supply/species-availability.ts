import type { NextApiRequest, NextApiResponse } from "next";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { hasValidOpsToken, requireOpsOrAdmin } from "@/lib/opsAuth";
import { listSpeciesAvailability, upsertSpeciesAvailability } from "@/lib/services/supplyAvailabilityService";

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
    const speciesName =
      typeof req.query.speciesName === "string" && req.query.speciesName.trim()
        ? req.query.speciesName.trim()
        : undefined;
    const rows = await listSpeciesAvailability({ region, speciesName });
    return res.status(200).json({ items: rows });
  }

  if (req.method === "POST") {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;
    const body = readJsonBody<Prisma.SpeciesAvailabilityCreateInput>(req.body);
    if (!body?.region || !body.speciesName) {
      return sendStructuredError(res, { code: "INVALID_BODY", message: "region and speciesName required" }, 400);
    }
    const row = await upsertSpeciesAvailability(body);
    return res.status(201).json(row);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET or POST" } });
}
