import type { NextApiRequest } from "next";
import { createHash } from "crypto";

/**
 * Reads client idempotency key from standard header or JSON body (body wins if both set and body non-empty).
 */
export function readIdempotencyKey(req: NextApiRequest, body: { idempotencyKey?: string | null } | null): string | null {
  const h =
    String(req.headers["idempotency-key"] ?? req.headers["x-idempotency-key"] ?? "")
      .trim() || null;
  const b = body?.idempotencyKey != null ? String(body.idempotencyKey).trim() : "";
  if (b) return b;
  return h;
}

/** Stable hash for idempotency request-body comparison (optional). */
export function stableRequestHash(payload: unknown): string {
  const s =
    typeof payload === "object" && payload !== null
      ? JSON.stringify(payload, Object.keys(payload as object).sort())
      : JSON.stringify(payload);
  return `sha256:${createHash("sha256").update(s).digest("hex")}`;
}
