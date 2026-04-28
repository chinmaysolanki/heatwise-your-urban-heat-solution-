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
  /** Annual mean temperature from previous full calendar year (Open-Meteo archive). Used for species matching. */
  annualAvgTempC: number;
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

/** For species matching — uses annual average temperature (Köppen-aligned thresholds) */
function deriveHeatExposureFromAnnual(annualAvgC: number): EnvDetectResult["heatExposure"] {
  if (annualAvgC >= 30) return "extreme"; // BWh hot desert / very hot tropical
  if (annualAvgC >= 25) return "high";    // Aw/Am hot tropical / semi-arid
  if (annualAvgC >= 18) return "medium";  // Cfa/Csa warm subtropical / Mediterranean
  return "low";                           // Temperate / cool
}

/** Fallback when archive is unavailable — uses today's daily max */
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
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Open-Meteo error ${res.status}`);
  return res.json() as Promise<{
    current: { temperature_2m: number; wind_speed_10m: number; uv_index?: number };
    daily: { temperature_2m_max: number[] };
  }>;
}

/**
 * Fetches the previous full calendar year's daily mean temperatures from
 * Open-Meteo's historical archive and computes the annual average.
 * This gives a stable climate signal for year-round plant species matching.
 */
async function fetchAnnualClimate(lat: number, lon: number): Promise<{ annualAvgTempC: number }> {
  const prevYear = new Date().getFullYear() - 1;
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("start_date", `${prevYear}-01-01`);
  url.searchParams.set("end_date", `${prevYear}-12-31`);
  url.searchParams.set("daily", "temperature_2m_mean");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString(), {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Open-Meteo archive error ${res.status}`);
  const data: any = await res.json();
  const temps: number[] = (data?.daily?.temperature_2m_mean ?? []).filter((v: any) => typeof v === "number");
  if (temps.length === 0) return { annualAvgTempC: 0 };
  const annualAvgTempC = Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10;
  return { annualAvgTempC };
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
    const [weather, locationLabel, annual] = await Promise.all([
      fetchWeather(lat, lon),
      reverseGeocode(lat, lon),
      // Archive call is best-effort — never blocks the response
      fetchAnnualClimate(lat, lon).catch(() => ({ annualAvgTempC: 0 })),
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

    const annualAvgTempC = annual.annualAvgTempC;

    // Use annual average for species heat-exposure classification (stable, climate-zone accurate).
    // Fall back to today's daily max if archive fetch failed (annualAvgTempC === 0).
    const heatExposure = annualAvgTempC > 0
      ? deriveHeatExposureFromAnnual(annualAvgTempC)
      : deriveHeatExposure(dailyMaxTempC);

    const windExposure = deriveWindExposure(windSpeedKmh);
    const sunExposure = deriveSunExposure(uvIndex, heatExposure);
    const windLevel = deriveWindLevel(windExposure);

    const result: EnvDetectResult = {
      latitude: lat,
      longitude: lon,
      locationLabel,
      currentTempC,
      dailyMaxTempC,
      annualAvgTempC,
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
