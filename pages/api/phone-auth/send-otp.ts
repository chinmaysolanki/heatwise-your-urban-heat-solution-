import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { generateOtpCode, normalizePhoneNumber } from "@/lib/phoneOtp";

/** HMAC-SHA256 token — stateless, no DB needed */
export function signDevToken(phone: string, code: string, expiresAt: number): string {
  const secret = process.env.NEXTAUTH_SECRET ?? "heatwise-dev-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(`${phone}|${code}|${expiresAt}`)
    .digest("hex");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const phoneNumber = normalizePhoneNumber((req.body ?? {}).phoneNumber);
  if (!phoneNumber) {
    return res.status(400).json({ message: "Invalid phone number" });
  }

  const otpCode   = generateOtpCode();
  const expiresAt = Date.now() + 10 * 60_000; // 10 min
  const devToken  = signDevToken(phoneNumber, otpCode, expiresAt);

  const isPostgres = (process.env.DATABASE_URL ?? "").startsWith("postgres");
  const isTwilio   = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
  const devOtp     = String(process.env.HEATWISE_DEV_OTP ?? "").toLowerCase() === "true";

  // ── Send real SMS via Twilio (independent of DB) ──────────────────────────
  let smsSent = false;
  if (isTwilio && !devOtp) {
    try {
      const { sendOtpSms } = await import("@/lib/phoneOtp");
      await sendOtpSms({ phoneNumber, otpCode });
      smsSent = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[HeatWise OTP] Twilio send failed:", err);
    }
  }

  // ── Persist to DB for DB-backed verification (Neon/postgres) ─────────────
  let savedToDb = false;
  if (isPostgres && !devOtp) {
    try {
      const { createOrReplaceOtp } = await import("@/lib/phoneOtp");
      await createOrReplaceOtp({ phoneNumber, otpCode, ttlMinutes: 10 });
      savedToDb = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[HeatWise OTP] DB save failed:", err);
    }
  }

  // ── Console fallback (always log when not sent via SMS) ───────────────────
  if (!smsSent) {
    // eslint-disable-next-line no-console
    console.log(`[HeatWise OTP] ${phoneNumber}: ${otpCode}`);
  }

  return res.status(200).json({
    ok:         true,
    phoneNumber,
    expiresAt:  new Date(expiresAt).toISOString(),
    // "sms" when Twilio delivered it; "console" when falling back to log
    delivery:   smsSent ? "sms" : "console",
    // Only expose the raw code in dev/console mode — never when SMS was sent
    debugOtp:   smsSent ? undefined : otpCode,
    // devToken is needed by verify-otp when DB is not available for verification
    devToken:   savedToDb ? undefined : devToken,
    notice:     smsSent
      ? undefined
      : "Dev mode — no SMS sent. Your code is shown below.",
  });
}
