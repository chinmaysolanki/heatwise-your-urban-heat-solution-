import type { NextApiResponse } from "next";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";

export function sendStructuredError(res: NextApiResponse, err: StructuredError, status: number): void {
  res.status(status).json({ error: err });
}

export function readJsonBody<T>(body: unknown): T | null {
  if (!body || typeof body !== "object") return null;
  return body as T;
}

export function parseIsoDate(q: string | string[] | undefined, label: string): Date | null {
  if (!q || Array.isArray(q)) return null;
  const d = new Date(q);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}
