import type { NextApiRequest, NextApiResponse } from "next";
import {
  createOrReplaceOtp,
  generateOtpCode,
  normalizePhoneNumber,
  sendOtpSms,
  usesConsoleOtpDelivery,
} from "@/lib/phoneOtp";

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
  const { expiresAt } = await createOrReplaceOtp({ phoneNumber, otpCode, ttlMinutes: 10 });

  await sendOtpSms({ phoneNumber, otpCode });

  const consoleDelivery = usesConsoleOtpDelivery();

  return res.status(200).json({
    ok: true,
    phoneNumber,
    expiresAt: expiresAt.toISOString(),
    /** `console` = no SMS; use `debugOtp` and/or server logs. */
    delivery: consoleDelivery ? "console" : "sms",
    debugOtp: consoleDelivery ? otpCode : undefined,
    notice: consoleDelivery
      ? "SMS is not sent in this environment. Use DEV OTP on the next screen and/or the terminal where the server runs."
      : undefined,
  });
}

