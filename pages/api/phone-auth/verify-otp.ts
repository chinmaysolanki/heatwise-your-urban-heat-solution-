import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import {
  normalizePhoneNumber,
  verifyOtpAndConsume,
  usesConsoleOtpDelivery,
} from "@/lib/phoneOtp";

/** Must match signDevToken() in send-otp.ts */
function verifyDevToken(
  phone: string,
  code: string,
  expiresAtMs: number,
  token: string,
): boolean {
  const secret = process.env.NEXTAUTH_SECRET ?? "heatwise-dev-secret";
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${phone}|${code}|${expiresAtMs}`)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const body        = (req.body ?? {}) as any;
  const phoneNumber = normalizePhoneNumber(body.phoneNumber);
  const otpCode     = String(body.otp ?? "").trim();

  if (!phoneNumber || otpCode.length < 4 || otpCode.length > 8) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  // ── Dev / no-DB mode ──────────────────────────────────────────────────────
  if (usesConsoleOtpDelivery()) {
    const devToken    = String(body.devToken ?? "");
    const expiresAtMs = Number(body.expiresAt ? new Date(body.expiresAt).getTime() : 0);

    if (!devToken || !expiresAtMs) {
      return res.status(400).json({ ok: false, message: "Missing dev token" });
    }
    if (Date.now() > expiresAtMs) {
      return res.status(400).json({ ok: false, reason: "expired", message: "OTP expired" });
    }
    if (!verifyDevToken(phoneNumber, otpCode, expiresAtMs, devToken)) {
      return res.status(400).json({ ok: false, reason: "invalid", message: "Invalid OTP" });
    }
    return res.status(200).json({ ok: true });
  }

  // ── Production mode (DB) ──────────────────────────────────────────────────
  const result = await verifyOtpAndConsume({ phoneNumber, otpCode });
  if (!result.ok) {
    const message =
      result.reason === "expired"            ? "OTP expired"
      : result.reason === "too_many_attempts"  ? "Too many attempts"
      : "Invalid OTP";
    return res.status(400).json({ ok: false, reason: result.reason, message });
  }

  return res.status(200).json({ ok: true });
}
