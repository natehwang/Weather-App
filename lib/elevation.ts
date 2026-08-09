import { getCached, roundCoord } from "./cache";

const CACHE_TTL_MS = 60 * 60 * 1000; // elevation is static; cache longer than weather data
const METERS_TO_FT = 3.28084;

async function fetchElevationFt(lat: number, lng: number): Promise<number | null> {
  const params = new URLSearchParams({ latitude: String(lat), longitude: String(lng) });
  const res = await fetch(`https://api.open-meteo.com/v1/elevation?${params.toString()}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { elevation?: number[] };
  const meters = json.elevation?.[0];
  return meters != null ? meters * METERS_TO_FT : null;
}

export function getElevationFt(lat: number, lng: number): Promise<number | null> {
  const cacheKey = `elevation:${roundCoord(lat)},${roundCoord(lng)}`;
  return getCached(cacheKey, CACHE_TTL_MS, () => fetchElevationFt(lat, lng));
}
