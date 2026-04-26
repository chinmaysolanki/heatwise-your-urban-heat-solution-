/**
 * Geolocation helper.
 * - Native Android/iOS (Capacitor): uses @capacitor/geolocation — native permission dialog
 * - Browser: uses navigator.geolocation
 *
 * Strategy:
 * 1. getCurrentPosition (high accuracy GPS)
 * 2. If result is 0,0 (invalid emulator default) → try getLastKnownPosition
 * 3. If still invalid → throw so caller can fall back to city search
 */

function isNativeApp() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.Capacitor?.isNativePlatform?.() === true) return true;
    if (window.Capacitor?.platform === 'android' || window.Capacitor?.platform === 'ios') return true;
    return false;
  } catch {
    return false;
  }
}

/** Returns true if coords look like the emulator 0,0 default or genuinely invalid */
function isInvalidCoord(lat, lon) {
  return (
    lat == null || lon == null ||
    !isFinite(lat) || !isFinite(lon) ||
    (Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01) // (0,0) = middle of ocean
  );
}

export async function getCurrentPosition() {
  if (isNativeApp()) {
    const { Geolocation } = await import('@capacitor/geolocation');

    // Request permission
    try {
      const perm = await Geolocation.requestPermissions();
      const granted = perm.location === 'granted' || perm.coarseLocation === 'granted';
      if (!granted) throw new Error('Location permission denied');
    } catch (e) {
      if (e.message === 'Location permission denied') throw e;
    }

    // 1. Try high-accuracy GPS first (works on real device + emulator with mock)
    let lat, lon;
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    } catch {
      // GPS timed out or unavailable — fall through to last known
    }

    // 2. If GPS returned 0,0 or failed, try last known position (faster, cached)
    if (isInvalidCoord(lat, lon)) {
      try {
        const last = await Geolocation.getLastKnownPosition();
        if (last && !isInvalidCoord(last.coords.latitude, last.coords.longitude)) {
          lat = last.coords.latitude;
          lon = last.coords.longitude;
        }
      } catch { /* ignore */ }
    }

    // 3. Try low-accuracy (network location) as last resort
    if (isInvalidCoord(lat, lon)) {
      try {
        const pos2 = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 8000,
        });
        lat = pos2.coords.latitude;
        lon = pos2.coords.longitude;
      } catch { /* ignore */ }
    }

    if (isInvalidCoord(lat, lon)) {
      throw new Error('Unable to determine location. Please search for your city.');
    }

    return { latitude: lat, longitude: lon };
  }

  // Browser fallback — navigator.geolocation
  return new Promise((resolve, reject) => {
    if (!navigator?.geolocation) {
      reject(new Error('Geolocation not supported in this browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (isInvalidCoord(latitude, longitude)) {
          reject(new Error('Invalid location returned. Please search for your city.'));
          return;
        }
        resolve({ latitude, longitude });
      },
      (err) => {
        const messages = {
          1: 'Location permission denied. Please allow location access and try again.',
          2: 'Location unavailable. Check GPS signal.',
          3: 'Location request timed out.',
        };
        reject(new Error(messages[err.code] || err.message));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  });
}
