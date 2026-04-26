import type { NextApiResponse } from "next";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";

export function sendStructuredError(res: NextApiResponse, err: StructuredError, status: number): void {
  res.status(status).json({ error: err });
}

export function parseWindow(req: { query: Record<string, string | string[] | undefined> }): {
  windowStart: Date;
  windowEnd: Date;
} | null {
  const ws = req.query.windowStart;
  const we = req.query.windowEnd;
  if (typeof ws !== "string" || typeof we !== "string") return null;
  const a = new Date(ws);
  const b = new Date(we);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a >= b) return null;
  return { windowStart: a, windowEnd: b };
}
