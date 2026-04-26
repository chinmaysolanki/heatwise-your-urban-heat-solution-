#!/usr/bin/env node
console.log(`
\x1b[36m[HeatWise Android]\x1b[0m
  Physical device + CAP_SERVER_URL=http://localhost:3000  →  run:
    \x1b[33madb reverse tcp:3000 tcp:3000\x1b[0m
  Android Emulator  →  use CAP_SERVER_URL=http://10.0.2.2:3000 and \x1b[33mnpm run android:sync\x1b[0m
  Wi‑Fi (no USB reverse)  →  use your Mac LAN IP in CAP_SERVER_URL + HEATWISE_DEV_EXTRA_ORIGINS (see ANDROID.md)
`);
