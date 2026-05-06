// Auth removed — admin routes use env-based allowlist only.
import type { NextApiRequest, NextApiResponse } from "next";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = (process.env.HEATWISE_ADMIN_EMAILS ?? "").trim();
  if (!allow) return process.env.NODE_ENV !== "production";
  return allow.split(",").map(s => s.trim().toLowerCase()).includes(String(email).toLowerCase());
}

export async function getAdminSession(_req: NextApiRequest, _res: NextApiResponse) {
  return null;
}

export async function requireAdminSession(_req: NextApiRequest, res: NextApiResponse) {
  res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Admin access unavailable" } });
  return null;
}
