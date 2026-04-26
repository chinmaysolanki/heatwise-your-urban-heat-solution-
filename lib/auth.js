import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "./db";
import bcrypt from "bcryptjs";
import { findOrCreateUserByPhone, normalizePhoneNumber, verifyOtpAndConsume } from "@/lib/phoneOtp";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: { email: {}, password: {}, phoneNumber: {}, otp: {} },
      async authorize(credentials) {
        const phoneNumber = normalizePhoneNumber(credentials?.phoneNumber);
        const otp = typeof credentials?.otp === "string" ? credentials.otp.trim() : "";

        // Phone + OTP login/signup flow
        if (phoneNumber && otp) {
          const result = await verifyOtpAndConsume({ phoneNumber, otpCode: otp });
          if (!result.ok) return null;

          const user = await findOrCreateUserByPhone(phoneNumber);
          return { id: user.id, name: user.name ?? "", email: user.email ?? null, phoneNumber: user.phoneNumber ?? phoneNumber };
        }

        const user = await db.user.findUnique({
          where: { email: credentials?.email ?? undefined },
        });
        if (!user) return null;
        if (!user.password || typeof credentials?.password !== "string") return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        return { id: user.id, name: user.name, email: user.email };
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
  secret: process.env.NEXTAUTH_SECRET,
};

