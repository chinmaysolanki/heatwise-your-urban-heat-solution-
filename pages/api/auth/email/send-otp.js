import crypto from "crypto";
import dns from "dns/promises";
import { Resend } from "resend";
import { db } from "@/lib/db";

const OTP_EXPIRY_MINUTES = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const lastSentAt = new Map();

// Known disposable/throwaway email domains — reject these
const BLOCKED_DOMAINS = new Set([
  "mailinator.com","guerrillamail.com","10minutemail.com","tempmail.com",
  "throwam.com","trashmail.com","yopmail.com","fakeinbox.com","sharklasers.com",
  "guerrillamailblock.com","grr.la","guerrillamail.info","guerrillamail.biz",
  "guerrillamail.de","guerrillamail.net","guerrillamail.org","spam4.me",
  "dispostable.com","maildrop.cc","discard.email","spamgourmet.com",
  "trashmail.at","trashmail.io","trashmail.me","trashmail.net","trashmail.org",
]);

// Validates email format + checks MX records to confirm domain can receive email
async function validateEmail(email) {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_RE.test(email)) return { valid: false, reason: "Invalid email format." };

  const domain = email.split("@")[1].toLowerCase();

  if (BLOCKED_DOMAINS.has(domain)) {
    return { valid: false, reason: "Disposable email addresses are not allowed." };
  }

  try {
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) {
      return { valid: false, reason: "This email domain cannot receive emails." };
    }
  } catch {
    return { valid: false, reason: "Email domain does not exist. Please check and try again." };
  }

  return { valid: true };
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

async function sendOtpEmail(email, otp) {
  const isDev = !process.env.RESEND_API_KEY || process.env.HEATWISE_DEV_OTP === "true";

  if (isDev) {
    console.log(`\n┌─────────────────────────────────────┐`);
    console.log(`│  HeatWise OTP for ${email}`);
    console.log(`│  Code: ${otp}`);
    console.log(`└─────────────────────────────────────┘\n`);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const from = process.env.RESEND_FROM ?? "HeatWise <hello@heatwise.in>";

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: `${otp} is your HeatWise verification code`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#f4f7f4;font-family:'Segoe UI',Arial,sans-serif">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
          <tr><td align="center">
            <table width="100%" style="max-width:480px;background:#0f1a12;border-radius:20px;overflow:hidden">

              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#1a3828,#2a5c3e);padding:32px 32px 24px;text-align:center">
                  <div style="font-size:36px;margin-bottom:8px">🌿</div>
                  <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:1px">HeatWise</div>
                  <div style="font-size:12px;color:rgba(224,245,232,0.55);margin-top:4px;letter-spacing:2px;text-transform:uppercase">Urban Cooling Intelligence</div>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:32px">
                  <p style="color:#c0e0cc;font-size:15px;margin:0 0 24px;line-height:1.6">
                    Hi there 👋<br><br>
                    Here is your email verification code for HeatWise:
                  </p>

                  <!-- OTP box -->
                  <div style="background:#1a3828;border:1.5px solid rgba(64,176,112,0.35);border-radius:16px;padding:28px;text-align:center;margin-bottom:24px">
                    <div style="font-family:'Courier New',monospace;font-size:44px;font-weight:800;letter-spacing:14px;color:#40b070;text-shadow:0 0 20px rgba(64,176,112,0.4)">${otp}</div>
                    <div style="font-size:12px;color:rgba(224,245,232,0.45);margin-top:10px;letter-spacing:1px">EXPIRES IN ${OTP_EXPIRY_MINUTES} MINUTES</div>
                  </div>

                  <p style="color:rgba(224,245,232,0.50);font-size:13px;margin:0;line-height:1.7">
                    If you didn't request this code, you can safely ignore this email.<br>
                    Never share this code with anyone.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:0 32px 28px;border-top:1px solid rgba(255,255,255,0.06)">
                  <p style="color:rgba(224,245,232,0.28);font-size:11px;margin:20px 0 0;text-align:center;line-height:1.6">
                    HeatWise · Bengaluru, India<br>
                    <a href="mailto:hello@heatwise.in" style="color:#40b070;text-decoration:none">hello@heatwise.in</a>
                  </p>
                </td>
              </tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
    text: `Your HeatWise verification code is: ${otp}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.\nNever share this code with anyone.\n\n— HeatWise Team\nhello@heatwise.in`,
  });

  if (error) throw new Error(error.message);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { email } = req.body ?? {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ message: "Email is required." });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Validate format + MX records
  const { valid, reason } = await validateEmail(normalizedEmail);
  if (!valid) return res.status(400).json({ message: reason });

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

  try {
    await sendOtpEmail(normalizedEmail, otp);
  } catch (e) {
    console.error("[HeatWise OTP] Email send failed:", e.message);
    return res.status(500).json({ message: "Could not send verification email. Please try again." });
  }

  lastSentAt.set(normalizedEmail, Date.now());
  return res.status(200).json({ message: "Verification code sent" });
}
