import "server-only";
import type { StationObservation, StationProvider } from "./providers/types";
import { purpleAirProvider } from "./providers/purpleair";

// Widen the search box automatically when too few stations are found —
// important in sparse areas like the Marin Headlands.
const RADII_MI = [1.5, 3, 6, 12, 25];
const MIN_STATIONS = 3;

const PROVIDERS: StationProvider[] = [purpleAirProvider];

export interface AggregateResult {
  stations: StationObservation[];
  radiusUsedMi: number;
}

export async function fetchNearbyStations(lat: number, lng: number): Promise<AggregateResult> {
  let stations: StationObservation[] = [];
  let radiusUsedMi = RADII_MI[0];

  for (const radiusMi of RADII_MI) {
    radiusUsedMi = radiusMi;
    const results = await Promise.all(
      PROVIDERS.map((provider) => provider.getNearbyObservations(lat, lng, radiusMi))
    );
    stations = results.flat();
    if (stations.length >= MIN_STATIONS) break;
  }

  return { stations, radiusUsedMi };
}
