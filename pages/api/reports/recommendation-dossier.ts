import type { NextApiRequest, NextApiResponse } from "next";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireOpsAdminOrProjectOwner } from "@/lib/opsAuth";
import type { AssembleRecommendationDossierInput } from "@/lib/reportingTypes";
import {
  assembleAndPersistRecommendationDossier,
  getRecommendationDossierById,
} from "@/lib/services/recommendationDossierService";

import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const session = await getServerSession(req, res, authOptions as NextAuthOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  if (req.method === "POST") {
    const body = readJsonBody<AssembleRecommendationDossierInput>(req.body);
    if (!body?.recommendationSessionId || !body.dossierType) {
      return sendStructuredError(
        res,
        { code: "INVALID_BODY", message: "recommendationSessionId and dossierType required" },
        400,
      );
    }
    const tel = await db.recommendationTelemetrySession.findUnique({
      where: { id: body.recommendationSessionId },
      select: { projectId: true },
    });
    if (!tel) {
      return sendStructuredError(res, { code: "NOT_FOUND", message: "recommendation session not found" }, 404);
    }
    const ok = await requireOpsAdminOrProjectOwner(req, res, tel.projectId, userId);
    if (!ok) return;

    const out = await assembleAndPersistRecommendationDossier(body);
    if (!out.ok) {
      return sendStructuredError(res, out.error, 400);
    }
    return res.status(201).json({ recommendationDossierId: out.recommendationDossierId });
  }

  if (req.method === "GET") {
    const id = typeof req.query.dossierId === "string" ? req.query.dossierId : null;
    if (!id) {
      return sendStructuredError(res, { code: "INVALID_QUERY", message: "dossierId required" }, 400);
    }
    const rowMeta = await db.recommendationDossier.findUnique({
      where: { id },
      select: { projectId: true },
    });
    if (!rowMeta) {
      return sendStructuredError(res, { code: "NOT_FOUND", message: "dossier not found" }, 404);
    }
    const ok = await requireOpsAdminOrProjectOwner(req, res, rowMeta.projectId, userId);
    if (!ok) return;

    const row = await getRecommendationDossierById(id);
    if (!row) {
      return sendStructuredError(res, { code: "NOT_FOUND", message: "dossier not found" }, 404);
    }
    return res.status(200).json({
      id: row.id,
      dossierType: row.dossierType,
      dossierVersion: row.dossierVersion,
      projectId: row.projectId,
      recommendationSessionId: row.recommendationSessionId,
      generatedAt: row.generatedAt.toISOString(),
      sectionCount: row.reportSections.length,
      explanationCount: row.reportExplanations.length,
    });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET or POST" } });
}
