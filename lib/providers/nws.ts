import { getCached, roundCoord } from "@/lib/cache";

const USER_AGENT = "SF-Microclimate-Weather-App (nathanehwang@gmail.com)";
const CACHE_TTL_MS = 10 * 60 * 1000;
const FOG_REGEX = /\bfog\b|marine layer/i;

export interface NwsAlert {
  event: string;
  headline: string;
}

export interface NwsConditions {
  fogLikely: boolean;
  shortForecast: string | null;
  alerts: NwsAlert[];
}

interface NwsPointsResponse {
  properties?: { forecast?: string };
}
interface NwsForecastResponse {
  properties?: { periods?: { shortForecast?: string; detailedForecast?: string }[] };
}
interface NwsAlertsResponse {
  features?: { properties?: { event?: string; headline?: string } }[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" },
  });
  if (!res.ok) {
    throw new Error(`NWS request failed (${res.status}): ${url}`);
  }
  return res.json() as Promise<T>;
}

async function fetchNwsConditions(lat: number, lng: number): Promise<NwsConditions> {
  const points = await fetchJson<NwsPointsResponse>(
    `https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`
  );
  const forecastUrl = points.properties?.forecast;

  const [forecast, alertsResp] = await Promise.all([
    forecastUrl ? fetchJson<NwsForecastResponse>(forecastUrl).catch(() => null) : Promise.resolve(null),
    fetchJson<NwsAlertsResponse>(
      `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`
    ).catch(() => null),
  ]);

  const firstPeriod = forecast?.properties?.periods?.[0];
  const shortForecast = firstPeriod?.shortForecast ?? null;
  const detailedForecast = firstPeriod?.detailedForecast ?? "";
  const fogLikely = FOG_REGEX.test(detailedForecast) || FOG_REGEX.test(shortForecast ?? "");

  const alerts: NwsAlert[] = (alertsResp?.features ?? []).map((f) => ({
    event: f.properties?.event ?? "Alert",
    headline: f.properties?.headline ?? "",
  }));

  return { fogLikely, shortForecast, alerts };
}

export function getNwsConditions(lat: number, lng: number): Promise<NwsConditions> {
  const cacheKey = `nws:${roundCoord(lat)},${roundCoord(lng)}`;
  return getCached(cacheKey, CACHE_TTL_MS, () => fetchNwsConditions(lat, lng));
}
