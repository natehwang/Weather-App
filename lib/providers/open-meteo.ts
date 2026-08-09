import { getCached, roundCoord } from "@/lib/cache";

const CACHE_TTL_MS = 10 * 60 * 1000;

export interface HourlyForecastPoint {
  time: string;
  tempF: number | null;
  windSpeedMph: number | null;
  precipProbabilityPct: number | null;
}

export interface OpenMeteoPoint {
  tempF: number | null;
  windSpeedMph: number | null;
  windDirectionDeg: number | null;
  windGustMph: number | null;
  visibilityM: number | null;
  cloudCoverPct: number | null;
  observedAt: string | null;
  hourly: HourlyForecastPoint[];
}

interface OpenMeteoResponse {
  current?: {
    time: string;
    temperature_2m?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    wind_gusts_10m?: number;
    visibility?: number;
    cloud_cover?: number;
  };
  hourly?: {
    time: string[];
    temperature_2m?: number[];
    wind_speed_10m?: number[];
    precipitation_probability?: number[];
  };
}

async function fetchOpenMeteo(lat: number, lng: number): Promise<OpenMeteoPoint> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: "temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,cloud_cover",
    hourly: "temperature_2m,wind_speed_10m,precipitation_probability",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    forecast_days: "2",
    // Without this, Open-Meteo defaults to GMT and returns naive time
    // strings that get misread as local time, shifting the forecast by
    // the timezone offset (e.g. +7h in Pacific summer time).
    timezone: "auto",
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Open-Meteo request failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as OpenMeteoResponse;

  const hourly: HourlyForecastPoint[] = [];
  if (json.hourly?.time) {
    // Both current.time and hourly.time are naive "YYYY-MM-DDTHH:mm"
    // strings in the location's own local time (timezone=auto above).
    // Compare them as strings/prefixes rather than via `new Date(...)`,
    // which would parse using the *server's* local timezone (UTC on
    // Vercel, but e.g. Pacific on a dev machine) and silently shift
    // the result depending on where the code happens to run.
    const currentHourPrefix = json.current?.time?.slice(0, 13); // "YYYY-MM-DDTHH"
    const startIndex = currentHourPrefix
      ? Math.max(
          0,
          json.hourly.time.findIndex((t) => t.slice(0, 13) >= currentHourPrefix)
        )
      : 0;

    for (let i = startIndex; i < json.hourly.time.length && hourly.length < 24; i++) {
      hourly.push({
        time: json.hourly.time[i],
        tempF: json.hourly.temperature_2m?.[i] ?? null,
        windSpeedMph: json.hourly.wind_speed_10m?.[i] ?? null,
        precipProbabilityPct: json.hourly.precipitation_probability?.[i] ?? null,
      });
    }
  }

  return {
    tempF: json.current?.temperature_2m ?? null,
    windSpeedMph: json.current?.wind_speed_10m ?? null,
    windDirectionDeg: json.current?.wind_direction_10m ?? null,
    windGustMph: json.current?.wind_gusts_10m ?? null,
    visibilityM: json.current?.visibility ?? null,
    cloudCoverPct: json.current?.cloud_cover ?? null,
    observedAt: json.current?.time ?? null,
    hourly,
  };
}

export function getOpenMeteoForecast(lat: number, lng: number): Promise<OpenMeteoPoint> {
  const cacheKey = `open-meteo:${roundCoord(lat)},${roundCoord(lng)}`;
  return getCached(cacheKey, CACHE_TTL_MS, () => fetchOpenMeteo(lat, lng));
}
