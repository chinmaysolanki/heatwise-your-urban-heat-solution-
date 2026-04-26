#!/usr/bin/env node
/**
 * build-android.mjs
 *
 * Builds a debug APK for Android testing.
 *
 * Usage:
 *   node scripts/build-android.mjs            # auto-detects LAN IP (Wi-Fi mode)
 *   node scripts/build-android.mjs --usb      # USB + adb reverse mode (localhost)
 *   node scripts/build-android.mjs --ip 192.168.1.42  # explicit IP
 *   node scripts/build-android.mjs --install  # build + adb install on connected phone
 *
 * After building, transfer the APK to your phone (see output for path + instructions).
 * Keep `npm run dev:android` running on this Mac while testing.
 */

import { spawnSync }                   from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname }            from "node:path";
import { fileURLToPath }               from "node:url";
import { networkInterfaces }           from "node:os";

const ROOT       = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NATIVE_DIR = resolve(ROOT, "heatwise-native");
const APK_OUT    = resolve(NATIVE_DIR, "android/app/build/outputs/apk/debug/app-debug.apk");
const GRADLEW    = resolve(NATIVE_DIR, "android/gradlew");
const ENV_FILE   = resolve(ROOT, ".env.local");

const args        = process.argv.slice(2);
const usbMode     = args.includes("--usb");
const installFlag = args.includes("--install");
const ipFlagIdx   = args.indexOf("--ip");
const explicitIp  = ipFlagIdx !== -1 ? args[ipFlagIdx + 1] : null;

// ── Colour helpers ─────────────────────────────────────────────
const C = { reset:"\x1b[0m", cyan:"\x1b[36m", green:"\x1b[32m", yellow:"\x1b[33m", red:"\x1b[31m", bold:"\x1b[1m" };
const log  = (m) => console.log(`${C.cyan}[build-android]${C.reset} ${m}`);
const ok   = (m) => console.log(`${C.green}✓${C.reset} ${m}`);
const warn = (m) => console.warn(`${C.yellow}⚠${C.reset}  ${m}`);
const fail = (m) => { console.error(`${C.red}✗${C.reset} ${m}`); process.exit(1); };
const run  = (cmd, opts = {}) => spawnSync(cmd, { shell: true, stdio: "inherit", ...opts });

// ── Detect LAN IP ──────────────────────────────────────────────
function getLanIp() {
  const nets = networkInterfaces();
  for (const name of ["en0", "en1", "eth0", "wlan0"]) {
    const iface = nets[name];
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address;
    }
  }
  for (const ifaces of Object.values(nets)) {
    for (const addr of ifaces) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address;
    }
  }
  return null;
}

// ── Determine server URL ───────────────────────────────────────
let serverUrl;
if (usbMode) {
  serverUrl = "http://localhost:3000";
  log("Mode: USB + adb reverse  (localhost)");
} else if (explicitIp) {
  serverUrl = `http://${explicitIp}:3000`;
  log(`Mode: Wi-Fi — explicit IP  ${serverUrl}`);
} else {
  const ip = getLanIp();
  if (!ip) fail("Could not detect LAN IP. Use --ip 192.168.x.x or --usb.");
  serverUrl = `http://${ip}:3000`;
  log(`Mode: Wi-Fi — auto-detected IP  ${serverUrl}`);
}

// ── Patch .env.local ───────────────────────────────────────────
log(`Updating .env.local → CAP_SERVER_URL=${serverUrl} …`);

function upsertEnvLine(src, key, value) {
  const re   = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  return re.test(src) ? src.replace(re, line) : src + (src && !src.endsWith("\n") ? "\n" : "") + line + "\n";
}

let env = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
env = upsertEnvLine(env, "CAP_SERVER_URL",   serverUrl);
env = upsertEnvLine(env, "NEXTAUTH_URL",      serverUrl);
env = upsertEnvLine(env, "HEATWISE_DEV_OTP", "true");
writeFileSync(ENV_FILE, env, "utf8");
ok(".env.local updated");

// ── Sync Capacitor ─────────────────────────────────────────────
log("Syncing Capacitor (cap sync android) …");
const sync = run("npm run android:sync", { cwd: ROOT });
if (sync.status !== 0) fail("Capacitor sync failed.");
ok("Capacitor synced");

// ── Build APK ──────────────────────────────────────────────────
log("Building debug APK (1–3 min on first run) …");
const build = run(`"${GRADLEW}" assembleDebug`, { cwd: resolve(NATIVE_DIR, "android") });
if (build.status !== 0) fail("Gradle build failed.");
ok(`APK built → ${APK_OUT}`);

// ── Optional: adb install ──────────────────────────────────────
if (usbMode || installFlag) {
  log("Installing on connected device via adb …");
  if (usbMode) {
    const rev = run("adb reverse tcp:3000 tcp:3000");
    if (rev.status !== 0) warn("adb reverse failed — is USB debugging enabled?");
    else ok("adb reverse: OK");
  }
  const inst = run(`adb install -r "${APK_OUT}"`);
  if (inst.status !== 0) fail("adb install failed — check USB debugging is on.");
  ok("APK installed on device");
}

// ── Serve APK over HTTP (for phone download) ───────────────────
const lanIp = getLanIp() ?? "YOUR_IP";

// ── Done ───────────────────────────────────────────────────────
const pad = "═".repeat(55);
console.log(`
${C.bold}${C.green}${pad}${C.reset}
${C.bold} HeatWise APK ready!${C.reset}
${C.green}${pad}${C.reset}

 APK:  ${C.cyan}${APK_OUT}${C.reset}
 Loads: ${C.cyan}${serverUrl}${C.reset}

${usbMode
  ? ` USB mode:
   1. Keep phone plugged in (USB debugging on)
   2. Terminal 2 → ${C.yellow}npm run dev:android${C.reset}
   3. Open HeatWise on phone`
  : ` Wi-Fi mode (phone + Mac must be on same network):
   1. Terminal 2 → ${C.yellow}npm run dev:android${C.reset}
   2. Transfer APK to phone — easiest options:
      a) Run in APK folder:
           ${C.yellow}cd "${resolve(NATIVE_DIR, "android/app/build/outputs/apk/debug")}" && python3 -m http.server 8888${C.reset}
         Then open in phone browser: ${C.cyan}http://${lanIp}:8888/app-debug.apk${C.reset}
      b) ADB (USB): ${C.yellow}adb install -r "${APK_OUT}"${C.reset}
      c) Upload to Google Drive and open on phone
   3. On phone: Settings → Apps → Special app access → Install unknown apps → allow Chrome/Files
   4. Open the APK file to install → launch HeatWise`
}

${C.green}${pad}${C.reset}
`);
