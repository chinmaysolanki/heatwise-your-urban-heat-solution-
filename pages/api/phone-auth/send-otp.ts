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

  const otpCode    = generateOtpCode();
  const expiresAt  = Date.now() + 10 * 60_000;  // 10 min
  const devToken   = signDevToken(phoneNumber, otpCode, expiresAt);

  // Try to persist to DB (works in production with Neon; skipped silently otherwise)
  let savedToDb = false;
  try {
    const isPostgres = (process.env.DATABASE_URL ?? "").startsWith("postgres");
    const devOtp     = String(process.env.HEATWISE_DEV_OTP ?? "").toLowerCase() === "true";
    if (isPostgres && !devOtp) {
      const { createOrReplaceOtp, sendOtpSms } = await import("@/lib/phoneOtp");
      await createOrReplaceOtp({ phoneNumber, otpCode, ttlMinutes: 10 });
      await sendOtpSms({ phoneNumber, otpCode });
      savedToDb = true;
    }
  } catch {
    // DB not connected or SMS not configured — fall through to stateless dev mode
    savedToDb = false;
  }

  // Log OTP to server console always (visible in Vercel function logs)
  // eslint-disable-next-line no-console
  console.log(`[HeatWise OTP] ${phoneNumber}: ${otpCode}`);

  return res.status(200).json({
    ok:         true,
    phoneNumber,
    expiresAt:  new Date(expiresAt).toISOString(),
    delivery:   savedToDb ? "sms" : "console",
    debugOtp:   savedToDb ? undefined : otpCode,
    devToken:   savedToDb ? undefined : devToken,
    notice:     savedToDb
      ? undefined
      : "Dev mode — no SMS sent. Your code is shown below.",
  });
}
