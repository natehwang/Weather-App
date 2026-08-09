import { haversineMiles } from "./geo";
import type { StationObservation } from "./providers/types";
import type { OpenMeteoPoint } from "./providers/open-meteo";

// Within this distance, a real Golden Gate wind reading beats the model.
const NDBC_PREFER_RADIUS_MI = 5;

export interface ResolvedWind {
  speedMph: number | null;
  directionDeg: number | null;
  gustMph: number | null;
  source: "ndbc" | "open-meteo" | null;
  stationId?: string;
}

function round1(value: number | null | undefined): number | null {
  return value != null ? Math.round(value * 10) / 10 : null;
}

export function resolveWind(
  lat: number,
  lng: number,
  stations: StationObservation[],
  openMeteo: OpenMeteoPoint | null
): ResolvedWind {
  const nearestNdbc = stations
    .filter((s) => s.sourceType === "ndbc" && s.windSpeedMph != null)
    .map((s) => ({ station: s, distanceMi: haversineMiles(lat, lng, s.lat, s.lng) }))
    .sort((a, b) => a.distanceMi - b.distanceMi)[0];

  if (nearestNdbc && nearestNdbc.distanceMi <= NDBC_PREFER_RADIUS_MI) {
    return {
      speedMph: round1(nearestNdbc.station.windSpeedMph),
      directionDeg: nearestNdbc.station.windDirectionDeg ?? null,
      // Always keep Open-Meteo for gusts, per the app spec.
      gustMph: round1(openMeteo?.windGustMph ?? nearestNdbc.station.windGustMph),
      source: "ndbc",
      stationId: nearestNdbc.station.id,
    };
  }

  return {
    speedMph: round1(openMeteo?.windSpeedMph),
    directionDeg: openMeteo?.windDirectionDeg ?? null,
    gustMph: round1(openMeteo?.windGustMph),
    source: openMeteo ? "open-meteo" : null,
  };
}
