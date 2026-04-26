/**
 * Dev/staging only: mint a NextAuth session cookie for automated HTTP E2E.
 *
 * Enable with `HEATWISE_ENABLE_E2E_ISSUER=1` and protect with `HEATWISE_E2E_ISSUER_SECRET`
 * (send header `x-heatwise-e2e-issuer-secret`).
 *
 * **Never enable in production** without network ACLs — this bypasses password/OTP.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { encode } from "next-auth/jwt";

import { db } from "@/lib/db";

import { readJsonBody, sendStructuredError } from "../installers/_utils";

type Body = { email?: string; userId?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (process.env.HEATWISE_ENABLE_E2E_ISSUER !== "1") {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
    return;
  }

  const expected = (process.env.HEATWISE_E2E_ISSUER_SECRET ?? "").trim();
  const got = String(req.headers["x-heatwise-e2e-issuer-secret"] ?? "").trim();
  if (!expected || got !== expected) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid E2E issuer secret" } });
    return;
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    res.status(500).json({ error: { code: "SERVER_MISCONFIGURED", message: "NEXTAUTH_SECRET missing" } });
    return;
  }

  const raw = readJsonBody<Body>(req.body);
  const email = raw?.email?.trim();
  const userId = raw?.userId?.trim();
  if (!email && !userId) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "email or userId required" }, 400);
  }

  const user = userId
    ? await db.user.findUnique({ where: { id: userId } })
    : await db.user.findUnique({ where: { email: email! } });
  if (!user) {
    return sendStructuredError(res, { code: "NOT_FOUND", message: "User not found" }, 404);
  }

  const token = await encode({
    token: {
      sub: user.id,
      id: user.id,
      email: user.email ?? "",
      name: user.name ?? "",
    },
    secret,
    maxAge: 60 * 60 * 24 * 7,
  });

  const secure = process.env.NODE_ENV === "production";
  const cookieName = secure ? "__Secure-next-auth.session-token" : "next-auth.session-token";
  const maxAge = 60 * 60 * 24 * 7;
  const segments = [`${cookieName}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${String(maxAge)}`];
  if (secure) segments.push("Secure");
  res.setHeader("Set-Cookie", segments.join("; "));
  res.status(200).json({
    ok: true,
    userId: user.id,
    cookieName,
  });
}
