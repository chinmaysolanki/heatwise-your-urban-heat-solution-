import crypto from "crypto";
import CredentialsProvider from "next-auth/providers/credentials";
import { findOrCreateUserByPhone, normalizePhoneNumber, usesConsoleOtpDelivery, verifyOtpAndConsume } from "@/lib/phoneOtp";

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

          // Dev / no-DB mode: verify with HMAC token instead of database
          if (usesConsoleOtpDelivery()) {
            const token      = String(credentials?.devToken  ?? "");
            const expiresAt  = Number(credentials?.expiresAt
              ? new Date(credentials.expiresAt).getTime()
              : 0);

            if (!token || !expiresAt) return null;
            if (Date.now() > expiresAt) return null;
            if (!verifyDevToken(phoneNumber, otp, expiresAt, token)) return null;

            // Try to persist the user to DB if available, else return synthetic user
            try {
              const user = await findOrCreateUserByPhone(phoneNumber);
              return { id: user.id, name: user.name ?? "", email: user.email ?? null, phoneNumber };
            } catch {
              // DB not yet connected — return a synthetic session so the app works
              return devUser(phoneNumber);
            }
          }

          // Production: verify against DB
          const result = await verifyOtpAndConsume({ phoneNumber, otpCode: otp });
          if (!result.ok) return null;

          const user = await findOrCreateUserByPhone(phoneNumber);
          return { id: user.id, name: user.name ?? "", email: user.email ?? null, phoneNumber };
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
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token) session.user.id = token.id;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? "heatwise-secret-fallback-set-in-vercel",
  pages: {
    error: "/",   // redirect auth errors back to home instead of NextAuth error page
  },
};
