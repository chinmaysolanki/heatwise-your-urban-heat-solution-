// Auth removed — app runs in guest mode, no sign-in required.
export const authOptions = { providers: [], secret: process.env.NEXTAUTH_SECRET ?? "heatwise-secret" };
