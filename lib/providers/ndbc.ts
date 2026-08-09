import type { StationObservation, StationProvider } from "./types";
import { getCached } from "@/lib/cache";

interface NdbcStationDef {
  id: string;
  name: string;
  lat: number;
  lng: number;
  elevationFt: number;
}

// Fixed real-time wind stations at the Golden Gate — the defining condition
// on the Headlands climbs. No key required.
const NDBC_STATIONS: NdbcStationDef[] = [
  { id: "FTPC1", name: "Fort Point", lat: 37.806, lng: -122.466, elevationFt: 16 },
  { id: "TIBC1", name: "Tiburon Pier", lat: 37.892, lng: -122.447, elevationFt: 10 },
];

const CACHE_TTL_MS = 10 * 60 * 1000; // NDBC updates roughly every 10 min
const MPS_TO_MPH = 2.23694;

function parseValue(raw: string | undefined): number | null {
  if (raw == null || raw === "MM" || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function fetchNdbcStation(def: NdbcStationDef): Promise<StationObservation | null> {
  const res = await fetch(`https://www.ndbc.noaa.gov/data/realtime2/${def.id}.txt`);
  if (!res.ok) return null;

  const text = await res.text();
  const lines = text.trim().split("\n");
  if (lines.length < 3) return null; // header, units, at least one obs row

  const headers = lines[0].replace(/^#/, "").trim().split(/\s+/);
  const cols = lines[2].trim().split(/\s+/); // most recent observation
  const col = (name: string) => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? cols[idx] : undefined;
  };

  const yr = parseValue(col("YY"));
  const mo = parseValue(col("MM"));
  const dd = parseValue(col("DD"));
  const hh = parseValue(col("hh"));
  const mi = parseValue(col("mm"));
  if (yr == null || mo == null || dd == null || hh == null || mi == null) return null;

  const wdir = parseValue(col("WDIR"));
  const wspd = parseValue(col("WSPD"));
  const gst = parseValue(col("GST"));
  const atmp = parseValue(col("ATMP"));

  return {
    id: `ndbc:${def.id}`,
    lat: def.lat,
    lng: def.lng,
    tempF: atmp != null ? (atmp * 9) / 5 + 32 : null,
    humidityPct: null,
    aqiPm25: null,
    windSpeedMph: wspd != null ? wspd * MPS_TO_MPH : null,
    windDirectionDeg: wdir,
    windGustMph: gst != null ? gst * MPS_TO_MPH : null,
    elevationFt: def.elevationFt,
    lastSeen: Math.floor(Date.UTC(yr, mo - 1, dd, hh, mi) / 1000),
    sourceType: "ndbc",
  };
}

export const ndbcProvider: StationProvider = {
  sourceType: "ndbc",
  // Only 2 fixed stations exist — no bounding-box efficiency reason to
  // filter by radius like PurpleAir does. Always return both; distance
  // weighting downstream (IDW, wind resolution) handles relevance.
  async getNearbyObservations() {
    const observations = await Promise.all(
      NDBC_STATIONS.map((def) => getCached(`ndbc:${def.id}`, CACHE_TTL_MS, () => fetchNdbcStation(def)))
    );
    return observations.filter((o): o is StationObservation => o !== null);
  },
};
