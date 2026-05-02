/** @type {import('next').NextConfig} */
const extraOrigins = (process.env.HEATWISE_DEV_EXTRA_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Marketing website origins allowed to call our API
// Add your Lovable site URL to HEATWISE_WEBSITE_ORIGINS in Vercel env vars
const websiteOrigins = (process.env.HEATWISE_WEBSITE_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = [
  "https://heatwise-liart.vercel.app",
  "https://heatwise-urban-cooling-buddy.lovable.app", // marketing site
  ...websiteOrigins,
  ...extraOrigins,
];

const nextConfig = {
  allowedDevOrigins: [
    "10.0.2.2",
    "localhost",
    "127.0.0.1",
    ...extraOrigins,
  ],
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },

  // CORS headers — lets the Lovable marketing site call /api/env/detect etc.
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            // In production set HEATWISE_WEBSITE_ORIGINS to your Lovable domain
            value: process.env.NODE_ENV === "development"
              ? "*"
              : allowedOrigins.join(", "),
          },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
