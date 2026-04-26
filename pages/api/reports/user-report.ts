import type { NextApiRequest, NextApiResponse } from "next";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { buildDemoUserReport } from "@/lib/demoPresentation";
import { db } from "@/lib/db";
import { requireOpsAdminOrProjectOwner } from "@/lib/opsAuth";
import { getUserReportPayload } from "@/lib/services/userReportService";

import { sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET only" } });
  }

  const id = typeof req.query.dossierId === "string" ? req.query.dossierId : null;
  if (!id) {
    return sendStructuredError(res, { code: "INVALID_QUERY", message: "dossierId required" }, 400);
  }

  const session = await getServerSession(req, res, authOptions as NextAuthOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const dossier = await db.recommendationDossier.findUnique({
    where: { id },
    select: { projectId: true },
  });
  if (!dossier) {
    return sendStructuredError(res, { code: "NOT_FOUND", message: "dossier not found" }, 404);
  }

  const ok = await requireOpsAdminOrProjectOwner(req, res, dossier.projectId, userId);
  if (!ok) return;

  const out = await getUserReportPayload(id);
  if (!out.ok) {
    return sendStructuredError(res, out.error, 404);
  }

  const formatDemo = req.query.format === "demo";
  if (formatDemo) {
    return res.status(200).json({
      scope: "user",
      format: "demo",
      summary: buildDemoUserReport(out.report),
    });
  }

  return res.status(200).json({ scope: "user", ...out.report });
}
