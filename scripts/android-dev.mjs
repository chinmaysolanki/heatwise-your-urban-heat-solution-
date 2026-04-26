#!/usr/bin/env node
/**
 * Starts Next for Android testing:
 * 1) Tries adb reverse so http://localhost:3000 on the phone reaches your Mac.
 * 2) Binds Next on 0.0.0.0:3000.
 */
import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log(`
\x1b[36m[HeatWise Android dev]\x1b[0m
  USB phone + CAP_SERVER_URL localhost → we run \x1b[33madb reverse tcp:3000 tcp:3000\x1b[0m
  Emulator → use \x1b[33mCAP_SERVER_URL=http://10.0.2.2:3000\x1b[0m + same for NEXTAUTH_URL, then \x1b[33mnpm run android:sync\x1b[0m
  Wi‑Fi → use your Mac LAN IP in CAP_SERVER_URL + NEXTAUTH_URL (see ANDROID.md)
`);

try {
  execSync("adb reverse tcp:3000 tcp:3000", { stdio: "inherit" });
  console.log("\x1b[32m[HeatWise]\x1b[0m adb reverse: OK\n");
} catch {
  console.warn(
    "\x1b[33m[HeatWise]\x1b[0m adb reverse: failed (no USB device / adb not in PATH). " +
      "The app will show a connection error if it still loads http://localhost:3000.\n",
  );
}

const win = process.platform === "win32";
const child = spawn(win ? "npx.cmd" : "npx", ["next", "dev", "--hostname", "0.0.0.0", "--port", "3000"], {
  cwd: root,
  stdio: "inherit",
  shell: win,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
