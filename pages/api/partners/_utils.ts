import type { NextApiResponse } from "next";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";

export function sendStructuredError(res: NextApiResponse, err: StructuredError, status: number): void {
  res.status(status).json({ error: err });
}

export function readJsonBody<T>(body: unknown): T | null {
  if (!body || typeof body !== "object") return null;
  return body as T;
}
