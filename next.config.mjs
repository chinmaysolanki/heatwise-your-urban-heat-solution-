/** @type {import('next').NextConfig} */
const extraOrigins = (process.env.HEATWISE_DEV_EXTRA_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig = {
  // Capacitor / physical device / emulator hitting dev server by IP or 10.0.2.2
  allowedDevOrigins: [
    "10.0.2.2",
    "localhost",
    "127.0.0.1",
    ...extraOrigins,
  ],
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },
};

export default nextConfig;
