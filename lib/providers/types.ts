export type SourceType = "purpleair" | "open-meteo" | "ndbc" | "nws" | "synoptic";

export interface StationObservation {
  id: string;
  lat: number;
  lng: number;
  tempF: number | null;
  humidityPct: number | null;
  aqiPm25: number | null;
  windSpeedMph?: number | null;
  windDirectionDeg?: number | null;
  windGustMph?: number | null;
  /** Unix seconds. */
  lastSeen: number;
  sourceType: SourceType;
}

export interface StationProvider {
  sourceType: SourceType;
  getNearbyObservations(lat: number, lng: number, radiusMi: number): Promise<StationObservation[]>;
}
