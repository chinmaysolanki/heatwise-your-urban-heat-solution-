import type { CapacitorConfig } from "@capacitor/cli";
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Run Capacitor commands from `heatwise-native/` (see npm scripts in parent `heatwise/package.json`).
const nextRoot = resolve(process.cwd(), "..");
for (const name of [".env.local", ".env"] as const) {
  const p = resolve(nextRoot, name);
  if (existsSync(p)) loadEnv({ path: p, override: false });
}

const fromEnv =
  process.env.CAP_SERVER_URL?.trim() ||
  process.env.NEXT_PUBLIC_CAP_SERVER_URL?.trim() ||
  "";

// Default: USB + `adb reverse tcp:3000 tcp:3000` (see ANDROID.md).
// Android Emulator → host: CAP_SERVER_URL=http://10.0.2.2:3000
// Phone on Wi‑Fi: CAP_SERVER_URL=http://YOUR_LAN_IP:3000
const serverUrl = fromEnv || "http://localhost:3000";
const isHttps = serverUrl.startsWith("https://");
// Capacitor Android defaults androidScheme to "https"; must match an http:// dev server or WebView routing breaks.
const isLocalLoopback = /^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(serverUrl);

const config: CapacitorConfig = {
  appId: "com.chinmaysolanki.heatwise",
  appName: "HeatWise",
  webDir: "www",
  server: {
    url: serverUrl,
    cleartext: !isHttps,
    androidScheme: isHttps ? "https" : "http",
    ...(isLocalLoopback ? { hostname: "localhost" } : {}),
  },
};

export default config;
