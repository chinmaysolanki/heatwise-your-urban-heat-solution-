// Auth stub — phone verification removed. App runs in guest mode.
// API routes that check session will receive null and return 401 gracefully.
export const authOptions = {
  providers: [],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET ?? "heatwise-secret",
  pages: { error: "/" },
};
