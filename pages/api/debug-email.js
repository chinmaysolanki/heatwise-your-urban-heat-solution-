/**
 * Temporary debug endpoint — DELETE after fixing email.
 * GET /api/debug-email?to=your@email.com
 */
import { Resend } from "resend";

export default async function handler(req, res) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM;

  const config = {
    RESEND_API_KEY: resendKey ? `set (starts with ${resendKey.slice(0, 6)}...)` : "MISSING",
    RESEND_FROM: resendFrom || "MISSING",
    RAZORPAY_KEY_ID: keyId ? `set (${keyId.slice(0, 12)}...)` : "MISSING",
    NODE_ENV: process.env.NODE_ENV,
  };

  if (req.method === "GET" && req.query.to) {
    if (!resendKey) return res.status(500).json({ error: "RESEND_API_KEY not set", config });

    try {
      const resend = new Resend(resendKey);
      const { data, error } = await resend.emails.send({
        from: resendFrom || "HeatWise <hello@heatwise.codes>",
        to: req.query.to,
        subject: "HeatWise debug test",
        text: "If you see this, Resend is working correctly.",
      });
      if (error) return res.status(500).json({ error, config });
      return res.status(200).json({ ok: true, data, config });
    } catch (e) {
      return res.status(500).json({ error: e.message, config });
    }
  }

  return res.status(200).json({ config });
}
