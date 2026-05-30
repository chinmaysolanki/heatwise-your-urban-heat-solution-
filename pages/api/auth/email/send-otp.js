import crypto from "crypto";
import { Resend } from "resend";
import { db } from "@/lib/db";

const OTP_EXPIRY_MINUTES = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const lastSentAt = new Map();

const BLOCKED_DOMAINS = new Set([
  "mailinator.com","guerrillamail.com","10minutemail.com","tempmail.com",
  "throwam.com","trashmail.com","yopmail.com","fakeinbox.com","sharklasers.com",
]);

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

async function sendOtpEmail(email, otp) {
  const resendKey = process.env.RESEND_API_KEY;
  const isDev = !resendKey || process.env.HEATWISE_DEV_OTP === "true";

  if (isDev) {
    console.log(`\n[HeatWise OTP] DEV MODE — code for ${email}: ${otp}\n`);
    return;
  }

  const resend = new Resend(resendKey);
  const from = process.env.RESEND_FROM || "HeatWise <hello@heatwise.codes>";

  const { data, error } = await resend.emails.send({
    from,
    to: email,
    subject: `${otp} is your HeatWise verification code`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0f1a12;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1a3828,#2a5c3e);padding:32px;text-align:center">
          <div style="font-size:32px">🌿</div>
          <div style="font-size:20px;font-weight:800;color:#fff;margin-top:8px">HeatWise</div>
        </div>
        <div style="padding:32px">
          <p style="color:#c0e0cc;font-size:15px;margin:0 0 24px">Hi there, here is your verification code:</p>
          <div style="background:#1a3828;border:1.5px solid rgba(64,176,112,0.35);border-radius:12px;padding:28px;text-align:center;margin-bottom:24px">
            <div style="font-family:monospace;font-size:40px;font-weight:800;letter-spacing:12px;color:#40b070">${otp}</div>
            <div style="font-size:12px;color:rgba(224,245,232,0.45);margin-top:8px">EXPIRES IN ${OTP_EXPIRY_MINUTES} MINUTES</div>
          </div>
          <p style="color:rgba(224,245,232,0.5);font-size:13px;margin:0">Never share this code with anyone.</p>
        </div>
        <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center">
          <p style="color:rgba(224,245,232,0.28);font-size:11px;margin:0">
            HeatWise · Bengaluru, India ·
            <a href="mailto:hello@heatwise.codes" style="color:#40b070;text-decoration:none">hello@heatwise.codes</a>
          </p>
        </div>
      </div>
    `,
    text: `Your HeatWise code: ${otp}\nExpires in ${OTP_EXPIRY_MINUTES} minutes. Never share this code.`,
  });

  if (error) {
    console.error("[HeatWise OTP] Resend error:", JSON.stringify(error));
    const detail = [error.name, error.statusCode, error.message].filter(Boolean).join(" / ");
    throw new Error(detail || "Email send failed");
  }

  console.log("[HeatWise OTP] Sent to", email, "id:", data?.id);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { email } = req.body ?? {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ message: "Email is required." });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ message: "Invalid email format." });
  }

  const domain = normalizedEmail.split("@")[1];
  if (BLOCKED_DOMAINS.has(domain)) {
    return res.status(400).json({ message: "Disposable email addresses are not allowed." });
  }

  // Rate limit
  const lastSent = lastSentAt.get(normalizedEmail);
  if (lastSent && Date.now() - lastSent < RATE_LIMIT_WINDOW_MS) {
    const waitSecs = Math.ceil((RATE_LIMIT_WINDOW_MS - (Date.now() - lastSent)) / 1000);
    return res.status(429).json({ message: `Please wait ${waitSecs}s before requesting another code` });
  }

  const otp = generateOtp();
  const codeHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  try {
    await db.emailOtp.upsert({
      where: { email: normalizedEmail },
      create: { email: normalizedEmail, codeHash, expiresAt, updatedAt: new Date() },
      update: { codeHash, expiresAt, attempts: 0, consumedAt: null, updatedAt: new Date() },
    });
  } catch (e) {
    console.error("[HeatWise OTP] DB error:", e.message);
    return res.status(500).json({ message: `Database error: ${e.message}` });
  }

  try {
    await sendOtpEmail(normalizedEmail, otp);
  } catch (e) {
    console.error("[HeatWise OTP] Email send failed:", e.message);
    return res.status(500).json({ message: `Could not send verification email: ${e.message}` });
  }

  lastSentAt.set(normalizedEmail, Date.now());
  return res.status(200).json({ message: "Verification code sent" });
}
