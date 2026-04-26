/**
 * Internal / installer-ops authentication.
 *
 * - **User routes:** NextAuth session + project ownership (`requireProjectOwner`).
 * - **Ops:** `HEATWISE_OPS_TOKEN` header `x-heatwise-ops-token`.
 * - **Admin:** session with email in `HEATWISE_ADMIN_EMAILS` (`getAdminSession` / `isAdminEmail`).
 * - **Installer portal:** see `docs/INSTALLER_PORTAL_AUTH.md` and `lib/installerPortalAuth.ts`
 *   (per-installer keys via `HEATWISE_INSTALLER_PORTAL_KEYS_JSON` + headers, or legacy shared
 *   `HEATWISE_INSTALLER_PORTAL_TOKEN`).
 */
import type { NextApiRequest, NextApiResponse } from "next";

import { getAdminSession, isAdminEmail } from "@/lib/adminAuth";
import { db } from "@/lib/db";
import type { InstallerPortalCredentialMatch } from "@/lib/installerPortalAuth";
import { resolveInstallerPortalCredentials } from "@/lib/installerPortalAuth";

export function hasValidOpsToken(req: NextApiRequest): boolean {
  const secret = (process.env.HEATWISE_OPS_TOKEN ?? "").trim();
  if (!secret) return false;
  const hdr = String(req.headers["x-heatwise-ops-token"] ?? "").trim();
  return hdr === secret;
}

/** @deprecated Use `resolveInstallerPortalCredentials` — name retained for grep compatibility. */
export { hasValidInstallerPortalToken, resolveInstallerPortalCredentials } from "@/lib/installerPortalAuth";

export type InstallerRouteAuthContext =
  | { channel: "ops_token" }
  | { channel: "admin_session"; email: string | null }
  | { channel: "installer_portal"; credential: InstallerPortalCredentialMatch };

export async function requireOpsOrAdmin(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<boolean> {
  if (hasValidOpsToken(req)) return true;
  const session = await getAdminSession(req, res);
  const email = (session?.user as { email?: string | null } | undefined)?.email;
  if (session && isAdminEmail(email ?? null)) return true;
  res.status(401).json({
    error: { code: "UNAUTHORIZED", message: "Ops token or admin session required" },
  });
  return false;
}

/**
 * Installer portal credentials (per-installer or legacy shared), **or** ops token, **or** admin session.
 * Returns null if 401 was sent.
 */
export async function requireInstallerPortalOrOps(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<InstallerRouteAuthContext | null> {
  const portal = resolveInstallerPortalCredentials(req);
  if (portal) return { channel: "installer_portal", credential: portal };
  if (hasValidOpsToken(req)) return { channel: "ops_token" };
  const session = await getAdminSession(req, res);
  const email = (session?.user as { email?: string | null } | undefined)?.email;
  if (session && isAdminEmail(email ?? null)) {
    return { channel: "admin_session", email: email ?? null };
  }
  res.status(401).json({
    error: {
      code: "UNAUTHORIZED",
      message: "Installer portal auth (see x-heatwise-installer-* headers), ops token, or admin session required",
    },
  });
  return null;
}

export async function requireProjectOwner(
  req: NextApiRequest,
  res: NextApiResponse,
  projectId: string,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Session required" } });
    return false;
  }
  const p = await db.project.findUnique({ where: { id: projectId }, select: { userId: true } });
  if (!p || p.userId !== userId) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Project access denied" } });
    return false;
  }
  return true;
}

/** Ops token, admin session, or project owner — for demo-friendly dossier/report access. */
export async function requireOpsAdminOrProjectOwner(
  req: NextApiRequest,
  res: NextApiResponse,
  projectId: string,
  userId: string | null | undefined,
): Promise<boolean> {
  if (hasValidOpsToken(req)) return true;
  const session = await getAdminSession(req, res);
  const email = (session?.user as { email?: string | null } | undefined)?.email;
  if (session && isAdminEmail(email ?? null)) return true;
  return requireProjectOwner(req, res, projectId, userId);
}
