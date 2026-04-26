import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import { LESSON_CONFIDENCE, LESSON_POLARITIES } from "@/lib/learningInsightsConstants";

export type CreateLessonMemoryInput = {
  lessonKey: string;
  polarity: string;
  confidenceBand: string;
  summaryStructured: Record<string, unknown>;
  evidenceRefs: Array<{ layer: string; id: string; type?: string }>;
  relatedSegmentKey?: string | null;
  relatedRecommendationPatterns?: Record<string, unknown> | null;
  effectiveFrom?: string | Date | null;
  effectiveTo?: string | Date | null;
  createdBy?: string | null;
  metadata?: Record<string, unknown> | null;
};

function isPolarity(x: string): boolean {
  return (LESSON_POLARITIES as readonly string[]).includes(x);
}

function isConfidence(x: string): boolean {
  return (LESSON_CONFIDENCE as readonly string[]).includes(x);
}

function validateEvidenceRefs(refs: unknown): string | null {
  if (!Array.isArray(refs)) return "evidenceRefs must be array";
  for (const r of refs) {
    if (!r || typeof r !== "object") return "each evidence ref must be object";
    const o = r as Record<string, unknown>;
    if (typeof o.layer !== "string" || !o.layer.trim()) return "evidence.layer required";
    if (typeof o.id !== "string" || !o.id.trim()) return "evidence.id required";
  }
  return null;
}

export async function createLessonMemory(
  input: CreateLessonMemoryInput,
): Promise<{ ok: true; lessonMemoryId: string } | { ok: false; error: StructuredError }> {
  const key = String(input.lessonKey || "").trim();
  if (!key) return { ok: false, error: validationError("INVALID_BODY", "lessonKey required") };
  if (!isPolarity(input.polarity)) {
    return { ok: false, error: validationError("INVALID_POLARITY", "polarity must be works|fails|mixed") };
  }
  if (!isConfidence(input.confidenceBand)) {
    return { ok: false, error: validationError("INVALID_CONFIDENCE", "confidenceBand must be low|medium|high") };
  }

  const evErr = validateEvidenceRefs(input.evidenceRefs);
  if (evErr) return { ok: false, error: validationError("INVALID_EVIDENCE", evErr) };

  const existing = await db.lessonMemory.findUnique({ where: { lessonKey: key } });
  if (existing) {
    return { ok: false, error: validationError("DUPLICATE_LESSON", "lessonKey already exists") };
  }

  const row = await db.lessonMemory.create({
    data: {
      lessonKey: key,
      polarity: input.polarity,
      confidenceBand: input.confidenceBand,
      summaryStructuredJson: JSON.stringify(input.summaryStructured),
      evidenceRefsJson: JSON.stringify(input.evidenceRefs),
      relatedSegmentKey: input.relatedSegmentKey ?? undefined,
      relatedRecommendationPatternsJson: input.relatedRecommendationPatterns
        ? JSON.stringify(input.relatedRecommendationPatterns)
        : undefined,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : undefined,
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : undefined,
      createdBy: input.createdBy?.trim() || "system",
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });

  return { ok: true, lessonMemoryId: row.id };
}

export async function listLessonMemories(limit = 50) {
  return db.lessonMemory.findMany({
    orderBy: { updatedAt: "desc" },
    take: Math.min(Math.max(1, limit), 200),
  });
}

export async function getLessonMemoryByKey(lessonKey: string) {
  return db.lessonMemory.findUnique({ where: { lessonKey } });
}
