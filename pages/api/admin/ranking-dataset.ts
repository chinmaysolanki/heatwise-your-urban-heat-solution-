import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  buildRankingDatasetRows,
  computeRankingDatasetDiagnostics,
  rowsToCsv,
} from "@/lib/rankingDatasetExport";

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = (process.env.HEATWISE_ADMIN_EMAILS ?? "").trim();
  if (!allow) return process.env.NODE_ENV !== "production";
  const allowed = allow.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(String(email).toLowerCase());
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = (await getServerSession(req, res, authOptions as any)) as any;
  if (!session) return res.status(401).json({ message: "Unauthorized" });
  if (!isAdminEmail(session?.user?.email)) return res.status(403).json({ message: "Forbidden" });

  const format = String(req.query.format ?? "json").toLowerCase(); // json | csv
  const withDiagnostics =
    String(req.query.diagnostics ?? "false").toLowerCase() === "true";
  const limit = Math.min(5000, Math.max(1, Number(req.query.limit ?? 1000) || 1000));

  const [runs, photoSessions, installationRequests] = await Promise.all([
    db.recommendationRun.findMany({
      orderBy: { createdAt: "desc" },
      take: limit, // cap runs; rows may exceed depending on candidates per run
      include: {
        candidates: {
          include: {
            feedbackEvents: true,
          },
        },
      },
    }),
    db.photoSession.findMany({
      select: {
        id: true,
        widthM: true,
        lengthM: true,
        floorLevel: true,
      },
    }),
    db.installationRequest.findMany({
      select: {
        projectId: true,
      },
    }),
  ]);

  const rows = buildRankingDatasetRows({
    runs,
    photoSessions,
    installationRequests,
  });

  if (format === "csv") {
    const csv = rowsToCsv(rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"heatwise-ranking-dataset.csv\"");
    return res.status(200).send(csv);
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (withDiagnostics) {
    const diagnostics = computeRankingDatasetDiagnostics(rows);
    return res.status(200).json({ rows, diagnostics });
  }
  return res.status(200).json({ rows });
}

