import crypto from "crypto";
import CredentialsProvider from "next-auth/providers/credentials";
import { findOrCreateUserByPhone, normalizePhoneNumber, verifyOtpAndConsume } from "@/lib/phoneOtp";

/** Stateless HMAC verify — mirrors send-otp.ts signDevToken(). No DB needed. */
function verifyDevToken(phone, code, expiresAtMs, token) {
  try {
    const secret = process.env.NEXTAUTH_SECRET ?? "heatwise-dev-secret";
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${phone}|${code}|${expiresAtMs}`)
      .digest("hex");
    if (expected.length !== token.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

/** Minimal synthetic user for dev mode (no DB). */
function devUser(phoneNumber) {
  const id = `dev_${Buffer.from(phoneNumber).toString("base64").slice(0, 12)}`;
  return { id, name: "Dev User", email: null, phoneNumber };
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: {}, password: {}, phoneNumber: {}, otp: {},
        devToken: {}, expiresAt: {},
      },
      async authorize(credentials) {
        const phoneNumber = normalizePhoneNumber(credentials?.phoneNumber);
        const otp = typeof credentials?.otp === "string" ? credentials.otp.trim() : "";

        // ── Phone + OTP ──────────────────────────────────────────────────────
        if (phoneNumber && otp) {
          const token     = String(credentials?.devToken ?? "");
          const expiresAt = Number(credentials?.expiresAt
            ? new Date(credentials.expiresAt).getTime()
            : 0);

          // Stateless HMAC path — used whenever a devToken is present (dev OR Vercel without DB)
          if (token && expiresAt) {
            if (Date.now() > expiresAt) return null;
            if (!verifyDevToken(phoneNumber, otp, expiresAt, token)) return null;

            // Only hit DB if a PostgreSQL connection string is present.
            // Without it (SQLite local or no DATABASE_URL on Vercel) go straight
            // to the synthetic user — avoids the Prisma "DATABASE_URL not found" crash.
            const dbUrl = process.env.DATABASE_URL ?? "";
            if (!dbUrl.startsWith("postgres")) {
              return devUser(phoneNumber);
            }
            try {
              const user = await findOrCreateUserByPhone(phoneNumber);
              return { id: user.id, name: user.name ?? "", email: user.email ?? null, phoneNumber, profileCompleted: user.profileCompleted ?? false };
            } catch {
              // DB unreachable — synthetic session keeps the app usable
              return devUser(phoneNumber);
            }
          }

          // Production DB path — only when postgres DATABASE_URL is configured.
          // Without a postgres URL, there is no DB to verify against and no devToken
          // was provided, so we cannot authenticate.
          const isPostgres = (process.env.DATABASE_URL ?? "").startsWith("postgres");
          if (!isPostgres) return null;

          const result = await verifyOtpAndConsume({ phoneNumber, otpCode: otp });
          if (!result.ok) return null;

          const user = await findOrCreateUserByPhone(phoneNumber);
          return { id: user.id, name: user.name ?? "", email: user.email ?? null, phoneNumber, profileCompleted: user.profileCompleted ?? false };
        }

        // ── Email + password (fallback) ──────────────────────────────────────
        try {
          const { db } = await import("./db");
          const bcrypt = (await import("bcryptjs")).default;
          const user = await db.user.findUnique({ where: { email: credentials?.email ?? undefined } });
          if (!user || !user.password || typeof credentials?.password !== "string") return null;
          const valid = await bcrypt.compare(credentials.password, user.password);
          if (!valid) return null;
          return { id: user.id, name: user.name, email: user.email };
        } catch {
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.profileCompleted = user.profileCompleted ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.profileCompleted = token.profileCompleted ?? false;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? "heatwise-secret-fallback-set-in-vercel",
  pages: {
    error: "/",   // redirect auth errors back to home instead of NextAuth error page
  },
};
