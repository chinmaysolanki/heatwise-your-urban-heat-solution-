import type { NextApiRequest, NextApiResponse } from "next";
import { normalizePhoneNumber, verifyOtpAndConsume } from "@/lib/phoneOtp";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const body = req.body ?? {};
  const phoneNumber = normalizePhoneNumber((body as any).phoneNumber);
  const otpCode = String((body as any).otp ?? "").trim();

  if (!phoneNumber || otpCode.length < 4 || otpCode.length > 8) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  const result = await verifyOtpAndConsume({ phoneNumber, otpCode });
  if (!result.ok) {
    const message =
      result.reason === "expired"
        ? "OTP expired"
        : result.reason === "too_many_attempts"
          ? "Too many attempts"
          : "Invalid OTP";
    return res.status(400).json({ ok: false, reason: result.reason, message });
  }

  return res.status(200).json({ ok: true });
}

