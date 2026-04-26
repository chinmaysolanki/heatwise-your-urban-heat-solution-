# Run HeatWise on Android Studio

The native project is a **Capacitor shell** that loads your **Next.js** app from your machine (or a deployed URL). APIs and auth live on the server—you must have Next running and reachable from the phone/emulator.

## Quick start: Android Emulator (Android Studio)

1. **JDK:** Android Studio → *Settings → Build … → Gradle → Gradle JDK* → **21**.
2. **Env** — in **`heatwise/.env.local`** (emulator cannot use `localhost` for your Mac; use the host loopback alias):

   ```env
   CAP_SERVER_URL=http://10.0.2.2:3000
   NEXTAUTH_URL=http://10.0.2.2:3000
   NEXTAUTH_SECRET=your-secret
   DATABASE_URL=file:./dev.db
   HEATWISE_DEV_OTP=true
   ```

3. **Sync Capacitor** (picks up `CAP_SERVER_URL`):

   ```bash
   cd heatwise
   npm run android:sync
   ```

4. **Terminal 1 — start Next** (listens on all interfaces; emulator reaches it via `10.0.2.2`):

   ```bash
   cd heatwise
   npm run dev:android
   ```

   (`adb reverse` may warn if no USB device — that’s OK for emulator-only.)

5. **Terminal 2 — open the Android project:**

   ```bash
   cd heatwise
   npm run android:open
   ```

6. In **Android Studio**: start your **AVD** (or connect a device), select it → click **Run** ▶ on the `app` configuration.

If the WebView is blank, confirm `http://10.0.2.2:3000` opens on the **desktop** (it may not — that’s normal); the important part is Next running and the env/sync steps above.

---

## 1. One-time setup

**Android Studio:** use **JDK 21** for Gradle (*Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK*). The project also configures a **Java 21 toolchain** so Gradle can download one via the Foojay resolver if needed.

```bash
cd heatwise
npm install
npx prisma migrate deploy
```

Add to **`heatwise/.env.local`** (same host the WebView will use):

```env
# Must match the URL the app loads (see scenarios below)
NEXTAUTH_URL=http://localhost:3000

# Optional override; defaults to http://localhost:3000
# CAP_SERVER_URL=http://localhost:3000
```

For **production-like** local runs (OTP logged to server console):

```env
HEATWISE_DEV_OTP=true
```

## 2. Start the Next server (Terminal 1)

**Development (hot reload)** — this script **also runs `adb reverse tcp:3000 tcp:3000`** for USB phones using `localhost`:

```bash
cd heatwise
npm run dev:android
```

If you see **“Web page not available”**, `adb reverse` failed (no device / USB debugging off). Fix USB or switch to **emulator / Wi‑Fi** URLs below.

**OR production build (often more stable on device):**

```bash
cd heatwise
npm run build
HEATWISE_DEV_OTP=true npm run start:android
```

`dev:android` / `start:android` bind **`0.0.0.0:3000`** so other devices on the LAN can connect.

## 3. Point the WebView at your server

| Scenario | `CAP_SERVER_URL` in `.env.local` | Extra |
|----------|----------------------------------|--------|
| **USB + adb reverse** | `http://localhost:3000` | Run: `adb reverse tcp:3000 tcp:3000` |
| **Android Emulator** | `http://10.0.2.2:3000` | Special IP to reach your Mac/PC host |
| **Phone on same Wi‑Fi** | `http://192.168.x.x:3000` | Use your computer’s LAN IP; **set `NEXTAUTH_URL` to the same** |

After changing `CAP_SERVER_URL` or `NEXTAUTH_URL`, restart Next and re-sync:

```bash
cd heatwise
npm run android:sync
```

## 4. Sync Capacitor & open Android Studio (Terminal 2)

```bash
cd heatwise
npm run android:studio
```

Or manually:

```bash
cd heatwise/heatwise-native
npm install
npx cap sync android
npx cap open android
```

In Android Studio: select a device/emulator → **Run** ▶.

## 5. Troubleshooting

### Fixed in repo (if you still had a blank page before)

- **`androidScheme` must be `http`** when your dev server is `http://…`. Capacitor’s Android default is `https`, which can break loading the Next dev server. Synced `capacitor.config.json` now includes `"androidScheme":"http"` for HTTP URLs.
- **`npm run dev:android`** now runs **`adb reverse tcp:3000 tcp:3000`** automatically (USB + `localhost`).

### “Web page not available” / blank WebView / connection error

| Setup | Cause | Fix |
|--------|--------|-----|
| **Physical phone**, `CAP_SERVER_URL=http://localhost:3000` | On the phone, **localhost is the phone**, not your computer. | Plug in USB and run: **`adb reverse tcp:3000 tcp:3000`**, then cold-start the app. |
| **Android Emulator** | `localhost` inside the emulator is the emulator itself. | Set **`CAP_SERVER_URL=http://10.0.2.2:3000`** and **`NEXTAUTH_URL=http://10.0.2.2:3000`**, then `npm run android:sync` and restart Next. |
| **Wi‑Fi phone** (no reverse) | App can’t reach your Mac. | Use **`http://YOUR_LAN_IP:3000`** for both `CAP_SERVER_URL` and `NEXTAUTH_URL`, add your LAN hostname/IP to **`HEATWISE_DEV_EXTRA_ORIGINS`** in `.env.local` (comma-separated), restart `npm run dev:android`. |
| **Any** | Next.js not running. | Start **`npm run dev:android`** (or `start:android`) on the Mac; confirm `http://127.0.0.1:3000` works in a desktop browser. |

### Other

- **Auth / session fails on phone** — `NEXTAUTH_URL` must match the exact origin the WebView uses (same as `CAP_SERVER_URL` when testing on device).
- **OTP in prod build** — Use `HEATWISE_DEV_OTP=true` for local demos only; implement real SMS for production.
- **Cleartext** — HTTP is allowed (`usesCleartextTraffic`, `network_security_config`, Capacitor `cleartext: true`). Use HTTPS for real production.

## Scripts reference

| Command | Purpose |
|---------|---------|
| `npm run dev:android` | Next dev on `0.0.0.0:3000` |
| `npm run start:android` | Next production on `0.0.0.0:3000` |
| `npm run android:sync` | `npm install` in native + `cap sync android` |
| `npm run android:open` | Open Android Studio project |
| `npm run android:studio` | Sync + open |
