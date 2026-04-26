/**
 * Installer portal authentication contract (v2).
 *
 * **Per-installer (preferred):**
 * - Headers: `x-heatwise-installer-id` (InstallerProfile.id) + `x-heatwise-installer-token` (secret).
 * - Secrets are loaded from `HEATWISE_INSTALLER_PORTAL_KEYS_JSON` — JSON object `{ "<installerId>": "<token>", ... }`.
 * - The token for that installer must match; identity is **attributable** and can be bound to install jobs.
 *
 * **Legacy shared portal:**
 * - Header: `x-heatwise-installer-token` matching `HEATWISE_INSTALLER_PORTAL_TOKEN`.
 * - Optional `x-heatwise-installer-id` is an **unverified claim** for logging only (not a security boundary).
 *
 * **Ops/admin** bypass uses separate headers/session (see `lib/opsAuth.ts`).
 */
import { createHash, timingSafeEqual } from "crypto";
import type { NextApiRequest } from "next";

export type InstallerPortalCredentialMatch =
  | { kind: "per_installer"; installerId: string }
  | { kind: "legacy_shared"; unverifiedInstallerIdClaim: string | null };

function hashToken(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

function safeTokenEquals(a: string, b: string): boolean {
  const ba = hashToken(a);
  const bb = hashToken(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function parsePortalKeys(): Record<string, string> | null {
  const raw = (process.env.HEATWISE_INSTALLER_PORTAL_KEYS_JSON ?? "").trim();
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === "string" && val.length > 0) out[k] = val;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/** Raw token string from request (trimmed), or null if missing. */
export function readInstallerPortalTokenHeader(req: NextApiRequest): string | null {
  const t = String(req.headers["x-heatwise-installer-token"] ?? "").trim();
  return t || null;
}

export function readInstallerIdHeader(req: NextApiRequest): string | null {
  const id = String(req.headers["x-heatwise-installer-id"] ?? "").trim();
  return id || null;
}

/**
 * Resolves installer portal credentials. Does **not** check ops/admin.
 * Returns null if portal headers do not authenticate.
 */
export function resolveInstallerPortalCredentials(req: NextApiRequest): InstallerPortalCredentialMatch | null {
  const token = readInstallerPortalTokenHeader(req);
  if (!token) return null;

  const installerIdHdr = readInstallerIdHeader(req);
  const keys = parsePortalKeys();

  if (installerIdHdr && keys && keys[installerIdHdr]) {
    if (safeTokenEquals(token, keys[installerIdHdr])) {
      return { kind: "per_installer", installerId: installerIdHdr };
    }
    return null;
  }

  const global = (process.env.HEATWISE_INSTALLER_PORTAL_TOKEN ?? "").trim();
  if (global && safeTokenEquals(token, global)) {
    return {
      kind: "legacy_shared",
      unverifiedInstallerIdClaim: installerIdHdr ?? null,
    };
  }

  return null;
}

/** @deprecated Prefer `resolveInstallerPortalCredentials` for attribution-aware checks. */
export function hasValidInstallerPortalToken(req: NextApiRequest): boolean {
  return resolveInstallerPortalCredentials(req) !== null;
}
