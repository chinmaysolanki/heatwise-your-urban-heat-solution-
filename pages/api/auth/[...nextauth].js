import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Vercel auto-sets VERCEL_URL but not NEXTAUTH_URL — patch it at runtime
if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

export default NextAuth(authOptions);
