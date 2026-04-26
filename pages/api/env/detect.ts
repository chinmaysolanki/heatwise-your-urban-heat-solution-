/**
 * POST /api/env/detect
 *
 * Accepts { lat, lon }, fetches live weather from Open-Meteo (free, no key required),
 * reverse-geocodes via Nominatim, and derives HeatWise environment signal values.
 *
 * Derived outputs:
 *   heatExposure  : "low" | "medium" | "high" | "extreme"  (from daily max temp)
 *   windExposure  : "sheltered" | "moderate" | "windy" | "severe"  (from wind speed km/h)
 *   sunExposure   : "shade" | "partial" | "full"  (derived from UV index)
 *   windLevel     : "low" | "medium" | "high"  (coarsened from windExposure)
 */

import type { NextApiRequest, NextApiResponse } from "next";

export type EnvDetectResult = {
  latitude: number;
  longitude: number;
  locationLabel: string;
  currentTempC: number;
  dailyMaxTempC: number;
  windSpeedKmh: number;
  uvIndex: number | null;
  heatExposure: "low" | "medium" | "high" | "extreme";
  windExposure: "sheltered" | "moderate" | "windy" | "severe";
  /** Derived for the recommendation engine: maps heatExposure → SunExposure domain */
  sunExposure: "shade" | "partial" | "full";
  /** Derived for the recommendation engine: coarsened wind signal */
  windLevel: "low" | "medium" | "high";
  fetchedAt: string;
};

function deriveHeatExposure(dailyMaxC: number): EnvDetectResult["heatExposure"] {
  if (dailyMaxC >= 38) return "extreme";
  if (dailyMaxC >= 33) return "high";
  if (dailyMaxC >= 28) return "medium";
  return "low";
}

function deriveWindExposure(kmh: number): EnvDetectResult["windExposure"] {
  if (kmh >= 50) return "severe";
  if (kmh >= 30) return "windy";
  if (kmh >= 15) return "moderate";
  return "sheltered";
}

function deriveSunExposure(uvIndex: number | null, heatExposure: EnvDetectResult["heatExposure"]): EnvDetectResult["sunExposure"] {
  // Primary: UV index
  if (uvIndex != null) {
    if (uvIndex >= 6) return "full";
    if (uvIndex >= 3) return "partial";
    return "shade";
  }
  // Fallback: high/extreme heat implies high solar exposure on open rooftops
  if (heatExposure === "extreme" || heatExposure === "high") return "full";
  if (heatExposure === "medium") return "partial";
  return "shade";
}

function deriveWindLevel(windExposure: EnvDetectResult["windExposure"]): EnvDetectResult["windLevel"] {
  if (windExposure === "sheltered") return "low";
  if (windExposure === "severe" || windExposure === "windy") return "high";
  return "medium";
}

async function fetchWeather(lat: number, lon: number) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "temperature_2m,wind_speed_10m,uv_index");
  url.searchParams.set("daily", "temperature_2m_max");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "1");

  const res = await fetch(url.toString(), {
    headers: { "Accept": "application/json" },
    // 8-second timeout via AbortSignal
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Open-Meteo error ${res.status}`);
  return res.json() as Promise<{
    current: { temperature_2m: number; wind_speed_10m: number; uv_index?: number };
    daily: { temperature_2m_max: number[] };
  }>;
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`;
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "HeatWise/1.0 (rooftop garden planning app)",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    const data: any = await res.json();
    const addr = data.address ?? {};
    const parts = [addr.city ?? addr.town ?? addr.village, addr.state, addr.country]
      .filter(Boolean)
      .slice(0, 2);
    return parts.length > 0 ? parts.join(", ") : (data.display_name?.split(",")[0] ?? "Unknown location");
  } catch {
    return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { lat, lon } = req.body ?? {};
  if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ message: "lat and lon must be finite numbers" });
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ message: "lat/lon out of valid range" });
  }

  try {
    const [weather, locationLabel] = await Promise.all([
      fetchWeather(lat, lon),
      reverseGeocode(lat, lon),
    ]);

    const currentTempC = Math.round(weather.current.temperature_2m * 10) / 10;
    const windSpeedKmh = Math.round(weather.current.wind_speed_10m * 10) / 10;
    const uvIndex =
      typeof weather.current.uv_index === "number" && Number.isFinite(weather.current.uv_index)
        ? Math.round(weather.current.uv_index * 10) / 10
        : null;
    const dailyMaxRaw = weather.daily.temperature_2m_max?.[0];
    const dailyMaxTempC =
      typeof dailyMaxRaw === "number" && Number.isFinite(dailyMaxRaw)
        ? Math.round(dailyMaxRaw * 10) / 10
        : currentTempC + 3;

    const heatExposure = deriveHeatExposure(dailyMaxTempC);
    const windExposure = deriveWindExposure(windSpeedKmh);
    const sunExposure = deriveSunExposure(uvIndex, heatExposure);
    const windLevel = deriveWindLevel(windExposure);

    const result: EnvDetectResult = {
      latitude: lat,
      longitude: lon,
      locationLabel,
      currentTempC,
      dailyMaxTempC,
      windSpeedKmh,
      uvIndex,
      heatExposure,
      windExposure,
      sunExposure,
      windLevel,
      fetchedAt: new Date().toISOString(),
    };

    return res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Environment detection failed";
    return res.status(502).json({ message });
  }
}
