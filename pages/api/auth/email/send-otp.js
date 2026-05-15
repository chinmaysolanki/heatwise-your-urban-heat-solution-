import crypto from "crypto";
import { db } from "@/lib/db";

const OTP_EXPIRY_MINUTES = 10;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 send per minute per email
const lastSentAt = new Map(); // in-memory rate limit (resets on server restart)

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

async function sendOtpEmail(email, otp) {
  // In dev mode, just log the OTP
  if (process.env.NODE_ENV !== "production" || process.env.HEATWISE_DEV_OTP === "true") {
    console.log(`[HeatWise Email OTP] ${email} → ${otp}`);
    return;
  }

  // Production: use nodemailer with SMTP (configure SMTP_* env vars)
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"HeatWise" <${process.env.SMTP_FROM ?? "hello@heatwise.in"}>`,
    to: email,
    subject: `Your HeatWise verification code: ${otp}`,
    text: `Your HeatWise email verification code is: ${otp}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.\n\nIf you didn't request this, please ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f1a12;border-radius:16px;color:#e0f5e8">
        <div style="text-align:center;margin-bottom:32px">
          <span style="font-size:32px">🌿</span>
          <h1 style="margin:8px 0 0;font-size:22px;color:#40b070">HeatWise</h1>
        </div>
        <p style="color:#c0e0cc;margin:0 0 8px">Your verification code:</p>
        <div style="background:#1a3828;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px">
          <span style="font-family:monospace;font-size:40px;font-weight:700;letter-spacing:12px;color:#40b070">${otp}</span>
        </div>
        <p style="color:#c0e0cc;font-size:13px;margin:0">Expires in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { email } = req.body ?? {};
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ message: "Valid email required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Rate limit
  const lastSent = lastSentAt.get(normalizedEmail);
  if (lastSent && Date.now() - lastSent < RATE_LIMIT_WINDOW_MS) {
    const waitSecs = Math.ceil((RATE_LIMIT_WINDOW_MS - (Date.now() - lastSent)) / 1000);
    return res.status(429).json({ message: `Please wait ${waitSecs}s before requesting another code` });
  }

  const otp = generateOtp();
  const codeHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await db.emailOtp.upsert({
    where: { email: normalizedEmail },
    create: { email: normalizedEmail, codeHash, expiresAt, updatedAt: new Date() },
    update: { codeHash, expiresAt, attempts: 0, consumedAt: null, updatedAt: new Date() },
  });

  await sendOtpEmail(normalizedEmail, otp);
  lastSentAt.set(normalizedEmail, Date.now());

  return res.status(200).json({ message: "Verification code sent" });
}
