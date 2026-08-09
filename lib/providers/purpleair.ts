import "server-only";
import type { StationObservation, StationProvider } from "./types";
import { boundingBoxFromRadiusMi } from "@/lib/geo";
import { getCached, roundCoord } from "@/lib/cache";
import { pm25ToAqi } from "@/lib/aqi";

// PurpleAir's onboard temp/humidity sensors read biased because they sit
// inside the housing. Correction per the app spec; official/RAWS/NDBC
// stations need no such correction.
const TEMP_OFFSET_F = -8;
const HUMIDITY_OFFSET = 4;

const MAX_AGE_SEC = 60 * 60; // only sensors seen in the last hour
const CACHE_TTL_MS = 10 * 60 * 1000; // stations refresh ~every 10 min anyway

interface PurpleAirSensorsResponse {
  fields: string[];
  data: (number | null)[][];
}

async function fetchPurpleAirSensors(lat: number, lng: number, radiusMi: number): Promise<StationObservation[]> {
  const apiKey = process.env.PURPLEAIR_API_KEY;
  if (!apiKey) {
    throw new Error("PURPLEAIR_API_KEY is not configured on the server");
  }

  const bbox = boundingBoxFromRadiusMi(lat, lng, radiusMi);
  const params = new URLSearchParams({
    fields: "temperature,humidity,pm2.5_atm,latitude,longitude,last_seen,altitude",
    location_type: "0", // outdoor only
    max_age: String(MAX_AGE_SEC),
    nwlng: bbox.nwLng.toFixed(6),
    nwlat: bbox.nwLat.toFixed(6),
    selng: bbox.seLng.toFixed(6),
    selat: bbox.seLat.toFixed(6),
  });

  const res = await fetch(`https://api.purpleair.com/v1/sensors?${params.toString()}`, {
    headers: { "X-API-Key": apiKey },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PurpleAir request failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as PurpleAirSensorsResponse;
  const indexOf = (name: string) => json.fields.indexOf(name);
  const iSensorIndex = indexOf("sensor_index");
  const iTemp = indexOf("temperature");
  const iHumidity = indexOf("humidity");
  const iPm25 = indexOf("pm2.5_atm");
  const iLat = indexOf("latitude");
  const iLng = indexOf("longitude");
  const iLastSeen = indexOf("last_seen");
  const iAltitude = indexOf("altitude");

  const observations: StationObservation[] = [];
  for (const row of json.data) {
    const rowLat = iLat >= 0 ? (row[iLat] as number | null) : null;
    const rowLng = iLng >= 0 ? (row[iLng] as number | null) : null;
    const lastSeen = iLastSeen >= 0 ? (row[iLastSeen] as number | null) : null;
    if (rowLat == null || rowLng == null || lastSeen == null) continue;

    const rawTemp = iTemp >= 0 ? (row[iTemp] as number | null) : null;
    const rawHumidity = iHumidity >= 0 ? (row[iHumidity] as number | null) : null;
    const rawPm25 = iPm25 >= 0 ? (row[iPm25] as number | null) : null;
    const elevationFt = iAltitude >= 0 ? (row[iAltitude] as number | null) : null;

    observations.push({
      id: `purpleair:${iSensorIndex >= 0 ? row[iSensorIndex] : `${rowLat},${rowLng}`}`,
      lat: rowLat,
      lng: rowLng,
      tempF: rawTemp != null ? rawTemp + TEMP_OFFSET_F : null,
      humidityPct: rawHumidity != null ? rawHumidity + HUMIDITY_OFFSET : null,
      aqiPm25: rawPm25 != null ? pm25ToAqi(rawPm25) : null,
      elevationFt,
      lastSeen,
      sourceType: "purpleair",
    });
  }
  return observations;
}

export const purpleAirProvider: StationProvider = {
  sourceType: "purpleair",
  getNearbyObservations(lat, lng, radiusMi) {
    const cacheKey = `purpleair:${roundCoord(lat)},${roundCoord(lng)}:${radiusMi}`;
    return getCached(cacheKey, CACHE_TTL_MS, () => fetchPurpleAirSensors(lat, lng, radiusMi));
  },
};
