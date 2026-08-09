import type { SourceType, StationObservation } from "./providers/types";
import { haversineMiles } from "./geo";

const RECENCY_WINDOW_SEC = 60 * 60; // drop stations not seen in the last ~60 min
const OUTLIER_THRESHOLD_F = 5; // drop temp readings >5°F from the neighbor median
const IDW_POWER = 2;
export const LAPSE_RATE_F_PER_1000FT = 3.5;
export const ELEVATION_FLAG_THRESHOLD_FT = 500;

// Relative trust per source when blending a metric. Official/RAWS/NDBC
// stations outweigh PurpleAir for temp; Open-Meteo is the lightest-weighted
// fallback since it's a model, not a ground reading.
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
  nearestStationElevationFt: number | null;
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

function interpolateValues(
  stations: StationWithDistance[],
  getValue: (station: StationWithDistance) => number | null,
  outlierThreshold: number | null
): number | null {
  const candidates = stations
    .map((station) => ({ station, value: getValue(station) }))
    .filter((c): c is { station: StationWithDistance; value: number } => c.value != null);
  const filtered =
    outlierThreshold != null ? rejectOutliers(candidates, (c) => c.value, outlierThreshold) : candidates;
  return idw(
    filtered.map((c) => ({
      value: c.value,
      distanceMi: c.station.distanceMi,
      weight: QUALITY_WEIGHT[c.station.sourceType],
    }))
  );
}

export function blendObservations(
  stations: StationObservation[],
  lat: number,
  lng: number,
  options: { nowSec?: number; targetElevationFt?: number | null } = {}
): BlendedResult {
  const nowSec = options.nowSec ?? Date.now() / 1000;
  const targetElevationFt = options.targetElevationFt ?? null;

  const withDistance: StationWithDistance[] = stations
    .filter((s) => nowSec - s.lastSeen <= RECENCY_WINDOW_SEC)
    .map((s) => ({ ...s, distanceMi: haversineMiles(lat, lng, s.lat, s.lng) }));

  // Project each station's temp to what it'd read at the target's elevation
  // before blending, so a summit query isn't just averaging sea-level sensors.
  const tempF = interpolateValues(
    withDistance,
    (s) => {
      if (s.tempF == null) return null;
      if (targetElevationFt != null && s.elevationFt != null) {
        return s.tempF - (LAPSE_RATE_F_PER_1000FT * (targetElevationFt - s.elevationFt)) / 1000;
      }
      return s.tempF;
    },
    OUTLIER_THRESHOLD_F
  );
  const humidityPct = interpolateValues(withDistance, (s) => s.humidityPct, null);
  const aqiPm25 = interpolateValues(withDistance, (s) => s.aqiPm25, null);

  let nearestStation: StationWithDistance | null = null;
  for (const s of withDistance) {
    if (!nearestStation || s.distanceMi < nearestStation.distanceMi) nearestStation = s;
  }

  return {
    tempF: tempF != null ? Math.round(tempF * 10) / 10 : null,
    humidityPct: humidityPct != null ? Math.round(humidityPct) : null,
    aqiPm25: aqiPm25 != null ? Math.round(aqiPm25) : null,
    stationCount: withDistance.length,
    nearestStationDistanceMi: nearestStation ? Math.round(nearestStation.distanceMi * 100) / 100 : null,
    nearestStationElevationFt: nearestStation?.elevationFt ?? null,
  };
}
