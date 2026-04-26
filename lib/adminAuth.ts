/**
 * Internal admin authentication — **not** a substitute for network ACLs or SSO in production.
 *
 * Placeholder assumptions:
 * - NextAuth session with `user.email` is present.
 * - `HEATWISE_ADMIN_EMAILS` is a comma-separated allowlist (required in production).
 * - If unset in production, admin routes should deny by default (see each handler).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import type { Session } from "next-auth";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = (process.env.HEATWISE_ADMIN_EMAILS ?? "").trim();
  if (!allow) {
    return process.env.NODE_ENV !== "production";
  }
  const allowed = allow.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(String(email).toLowerCase());
}

export async function getAdminSession(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<Session | null> {
  const session = (await getServerSession(req, res, authOptions as NextAuthOptions)) as Session | null;
  return session;
}

export async function requireAdminSession(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<Session | null> {
  const session = await getAdminSession(req, res);
  if (!session) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Session required" } });
    return null;
  }
  const email = (session.user as { email?: string | null } | undefined)?.email;
  if (!isAdminEmail(email ?? null)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Admin allowlist only" } });
    return null;
  }
  return session;
}
