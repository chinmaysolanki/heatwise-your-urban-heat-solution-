import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import {
  createOrReplaceOtp,
  generateOtpCode,
  normalizePhoneNumber,
  sendOtpSms,
  usesConsoleOtpDelivery,
} from "@/lib/phoneOtp";

/** HMAC-SHA256 of `phone|code|expiresAt` using NEXTAUTH_SECRET. */
function signDevToken(phone: string, code: string, expiresAt: number): string {
  const secret = process.env.NEXTAUTH_SECRET ?? "heatwise-dev-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(`${phone}|${code}|${expiresAt}`)
    .digest("hex");
}

export { signDevToken };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const phoneNumber = normalizePhoneNumber((req.body ?? {}).phoneNumber);
  if (!phoneNumber) {
    return res.status(400).json({ message: "Invalid phone number" });
  }

  const otpCode = generateOtpCode();
  const consoleDelivery = usesConsoleOtpDelivery();

  // ── Dev / no-DB mode ──────────────────────────────────────────────────────
  // When HEATWISE_DEV_OTP=true we skip the database entirely and use a
  // stateless signed token. This lets the app work before Neon is connected.
  if (consoleDelivery) {
    const expiresAt = Date.now() + 10 * 60_000; // 10 min
    const devToken  = signDevToken(phoneNumber, otpCode, expiresAt);

    // eslint-disable-next-line no-console
    console.log(`[HeatWise OTP] ${phoneNumber}: ${otpCode}`);

    return res.status(200).json({
      ok:        true,
      phoneNumber,
      expiresAt: new Date(expiresAt).toISOString(),
      delivery:  "console",
      debugOtp:  otpCode,
      devToken,                    // sent back to client, echoed on verify
      notice:    "Dev mode — no SMS sent. Code shown on screen.",
    });
  }

  // ── Production mode (DB + real SMS) ──────────────────────────────────────
  const { expiresAt } = await createOrReplaceOtp({ phoneNumber, otpCode, ttlMinutes: 10 });
  await sendOtpSms({ phoneNumber, otpCode });

  return res.status(200).json({
    ok:        true,
    phoneNumber,
    expiresAt: expiresAt.toISOString(),
    delivery:  "sms",
  });
}
