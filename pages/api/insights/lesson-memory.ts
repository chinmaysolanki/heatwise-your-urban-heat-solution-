import type { NextApiRequest, NextApiResponse } from "next";

import { requireOpsOrAdmin } from "@/lib/opsAuth";
import type { CreateLessonMemoryInput } from "@/lib/services/lessonMemoryService";
import { createLessonMemory, getLessonMemoryByKey, listLessonMemories } from "@/lib/services/lessonMemoryService";

function readJsonBody<T>(body: unknown): T | null {
  if (!body || typeof body !== "object") return null;
  return body as T;
}

function parseLessonRow(row: {
  id: string;
  lessonKey: string;
  polarity: string;
  confidenceBand: string;
  summaryStructuredJson: string;
  evidenceRefsJson: string;
  relatedSegmentKey: string | null;
  relatedRecommendationPatternsJson: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  metadataJson: string | null;
}) {
  return {
    lessonMemoryId: row.id,
    lessonKey: row.lessonKey,
    polarity: row.polarity,
    confidenceBand: row.confidenceBand,
    summaryStructured: JSON.parse(row.summaryStructuredJson) as unknown,
    evidenceRefs: JSON.parse(row.evidenceRefsJson) as unknown,
    relatedSegmentKey: row.relatedSegmentKey,
    relatedRecommendationPatterns: row.relatedRecommendationPatternsJson
      ? JSON.parse(row.relatedRecommendationPatternsJson)
      : null,
    effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    metadata: row.metadataJson ? JSON.parse(row.metadataJson) : null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  if (req.method === "GET") {
    const key = typeof req.query.lessonKey === "string" ? req.query.lessonKey : null;
    if (key) {
      const row = await getLessonMemoryByKey(key);
      if (!row) return res.status(404).json({ error: { code: "NOT_FOUND", message: "lesson not found" } });
      return res.status(200).json(parseLessonRow(row));
    }
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;
    const rows = await listLessonMemories(Number.isFinite(limit) ? limit : 50);
    return res.status(200).json({ lessons: rows.map(parseLessonRow) });
  }

  if (req.method === "POST") {
    const body = readJsonBody<CreateLessonMemoryInput>(req.body);
    if (!body) {
      return res.status(400).json({ error: { code: "INVALID_BODY", message: "JSON body required" } });
    }
    const out = await createLessonMemory(body);
    if (!out.ok) {
      return res.status(400).json({ error: out.error });
    }
    return res.status(201).json({ lessonMemoryId: out.lessonMemoryId });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET or POST" } });
}
