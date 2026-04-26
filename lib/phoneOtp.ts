import bcrypt from "bcryptjs";
// Lazy import db so module loads even when DATABASE_URL is not set
async function getDb() {
  const { db } = await import("@/lib/db");
  return db;
}

export function normalizePhoneNumber(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/[^\d]/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return hasPlus ? `+${digits}` : digits;
}

export function generateOtpCode(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}

export async function createOrReplaceOtp(params: {
  phoneNumber: string;
  otpCode: string;
  ttlMinutes?: number;
}): Promise<{ expiresAt: Date }> {
  const ttl = typeof params.ttlMinutes === "number" && params.ttlMinutes > 0 ? params.ttlMinutes : 10;
  const expiresAt = new Date(Date.now() + ttl * 60_000);
  const codeHash = await bcrypt.hash(params.otpCode, 10);

  const db = await getDb();
  await db.phoneOtp.upsert({
    where: { phoneNumber: params.phoneNumber },
    update: {
      codeHash,
      expiresAt,
      attempts: 0,
      consumedAt: null,
    },
    create: {
      phoneNumber: params.phoneNumber,
      codeHash,
      expiresAt,
      attempts: 0,
      consumedAt: null,
    },
  });

  return { expiresAt };
}

export async function verifyOtpAndConsume(params: {
  phoneNumber: string;
  otpCode: string;
}): Promise<{ ok: true } | { ok: false; reason: "invalid" | "expired" | "consumed" | "too_many_attempts" }> {
  const db = await getDb();
  const row = await db.phoneOtp.findUnique({ where: { phoneNumber: params.phoneNumber } });
  if (!row) return { ok: false, reason: "invalid" };
  if (row.consumedAt) return { ok: false, reason: "consumed" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (row.attempts >= 8) return { ok: false, reason: "too_many_attempts" };

  const valid = await bcrypt.compare(params.otpCode, row.codeHash);
  if (!valid) {
    await db.phoneOtp.update({
      where: { phoneNumber: params.phoneNumber },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "invalid" };
  }

  await db.phoneOtp.update({
    where: { phoneNumber: params.phoneNumber },
    data: { consumedAt: new Date() },
  });

  return { ok: true };
}

/** True when OTP is only printed to the server console (no real SMS). */
export function usesConsoleOtpDelivery(): boolean {
  const allowDevOtp = String(process.env.HEATWISE_DEV_OTP ?? "").toLowerCase() === "true";
  return process.env.NODE_ENV !== "production" || allowDevOtp;
}

export async function sendOtpSms(params: { phoneNumber: string; otpCode: string }): Promise<void> {
  // Production-ready abstraction: wire Twilio/etc here.
  // For now: log OTP in non-production to keep local demos unblocked.
  const allowDevOtp = String(process.env.HEATWISE_DEV_OTP ?? "").toLowerCase() === "true";
  if (process.env.NODE_ENV !== "production" || allowDevOtp) {
    // eslint-disable-next-line no-console
    console.log(`[HeatWise OTP] ${params.phoneNumber}: ${params.otpCode}`);
    return;
  }

  throw new Error("SMS provider not configured. Set up sendOtpSms for production.");
}

export async function findOrCreateUserByPhone(phoneNumber: string) {
  const db = await getDb();
  const existing = await db.user.findUnique({ where: { phoneNumber } });
  if (existing) {
    if (!existing.phoneVerified) {
      await db.user.update({
        where: { id: existing.id },
        data: { phoneVerified: true },
      });
    }
    return existing;
  }

  return await db.user.create({
    data: {
      name: "",
      email: null,
      password: null,
      phoneNumber,
      phoneVerified: true,
      profileCompleted: false,
    },
  });
}

