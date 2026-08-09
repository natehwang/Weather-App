import type { SourceType, StationObservation } from "./providers/types";
import { haversineMiles } from "./geo";

const RECENCY_WINDOW_SEC = 60 * 60; // drop stations not seen in the last ~60 min
const OUTLIER_THRESHOLD_F = 5; // drop temp readings >5°F from the neighbor median
const IDW_POWER = 2;

// Relative trust per source when blending a metric. Only PurpleAir feeds
// temp/humidity/AQI today; NDBC/NWS/Synoptic weights matter once those
// providers land (official/RAWS stations should outweigh PurpleAir for temp).
const QUALITY_WEIGHT: Record<SourceType, number> = {
  purpleair: 1,
  "open-meteo": 0.6,
  ndbc: 1.2,
  nws: 1,
  synoptic: 1.3,
};

interface StationWithDistance extends StationObservation {
  distanceMi: number;
}

export interface BlendedResult {
  tempF: number | null;
  humidityPct: number | null;
  aqiPm25: number | null;
  stationCount: number;
  nearestStationDistanceMi: number | null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function rejectOutliers<T>(items: T[], getValue: (item: T) => number, threshold: number): T[] {
  if (items.length < 3) return items; // not enough data to judge an outlier
  const med = median(items.map(getValue));
  return items.filter((item) => Math.abs(getValue(item) - med) <= threshold);
}

function idw(points: { value: number; distanceMi: number; weight: number }[]): number | null {
  if (points.length === 0) return null;
  const exact = points.find((p) => p.distanceMi < 0.01);
  if (exact) return exact.value;

  let weightedSum = 0;
  let weightTotal = 0;
  for (const p of points) {
    const w = p.weight / Math.pow(p.distanceMi, IDW_POWER);
    weightedSum += w * p.value;
    weightTotal += w;
  }
  return weightTotal > 0 ? weightedSum / weightTotal : null;
}

function interpolateMetric<K extends "tempF" | "humidityPct" | "aqiPm25">(
  stations: StationWithDistance[],
  key: K,
  outlierThreshold: number | null
): number | null {
  const candidates = stations.filter(
    (s): s is StationWithDistance & Record<K, number> => s[key] != null
  );
  const filtered =
    outlierThreshold != null ? rejectOutliers(candidates, (s) => s[key], outlierThreshold) : candidates;
  return idw(
    filtered.map((s) => ({
      value: s[key],
      distanceMi: s.distanceMi,
      weight: QUALITY_WEIGHT[s.sourceType],
    }))
  );
}

export function blendObservations(
  stations: StationObservation[],
  lat: number,
  lng: number,
  nowSec: number = Date.now() / 1000
): BlendedResult {
  const withDistance: StationWithDistance[] = stations
    .filter((s) => nowSec - s.lastSeen <= RECENCY_WINDOW_SEC)
    .map((s) => ({ ...s, distanceMi: haversineMiles(lat, lng, s.lat, s.lng) }));

  const tempF = interpolateMetric(withDistance, "tempF", OUTLIER_THRESHOLD_F);
  const humidityPct = interpolateMetric(withDistance, "humidityPct", null);
  const aqiPm25 = interpolateMetric(withDistance, "aqiPm25", null);

  const nearestStationDistanceMi =
    withDistance.length > 0 ? Math.min(...withDistance.map((s) => s.distanceMi)) : null;

  return {
    tempF: tempF != null ? Math.round(tempF * 10) / 10 : null,
    humidityPct: humidityPct != null ? Math.round(humidityPct) : null,
    aqiPm25: aqiPm25 != null ? Math.round(aqiPm25) : null,
    stationCount: withDistance.length,
    nearestStationDistanceMi,
  };
}
