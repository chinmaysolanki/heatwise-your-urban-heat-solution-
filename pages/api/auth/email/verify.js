import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const MAX_ATTEMPTS = 5;

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { email, code } = req.body ?? {};
  if (!email || !code) return res.status(400).json({ message: "Email and code required" });

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedCode = String(code).trim();

  const record = await db.emailOtp.findUnique({ where: { email: normalizedEmail } });

  if (!record) return res.status(400).json({ message: "No verification code found. Please request a new one." });
  if (record.consumedAt) return res.status(400).json({ message: "Code already used. Please request a new one." });
  if (new Date() > record.expiresAt) return res.status(400).json({ message: "Code expired. Please request a new one." });
  if (record.attempts >= MAX_ATTEMPTS) return res.status(429).json({ message: "Too many attempts. Please request a new code." });

  const inputHash = hashOtp(trimmedCode);
  if (inputHash !== record.codeHash) {
    await db.emailOtp.update({
      where: { email: normalizedEmail },
      data: { attempts: { increment: 1 }, updatedAt: new Date() },
    });
    const remaining = MAX_ATTEMPTS - record.attempts - 1;
    return res.status(400).json({ message: `Incorrect code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.` });
  }

  // Mark consumed
  await db.emailOtp.update({
    where: { email: normalizedEmail },
    data: { consumedAt: new Date(), updatedAt: new Date() },
  });

  // Determine which user to update: session user (if logged in) or by email
  let userId = null;
  try {
    const session = await getServerSession(req, res, authOptions);
    if (session?.user?.id) userId = session.user.id;
  } catch {}

  if (userId) {
    // Update logged-in user's email + verified status
    await db.user.update({
      where: { id: userId },
      data: { email: normalizedEmail, emailVerified: true },
    });
  } else {
    // Try to find user by email and mark verified
    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      await db.user.update({ where: { id: existing.id }, data: { emailVerified: true } });
    }
    // If no user exists, emailVerified will be set when the account is created
  }

  return res.status(200).json({ message: "Email verified successfully", email: normalizedEmail });
}
