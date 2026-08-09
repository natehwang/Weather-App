"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import styles from "./page.module.css";
import { degreesToCompass } from "@/lib/compass";
import { kitRecommendation } from "@/lib/kit";
import { bearingDeg } from "@/lib/geo";
import { computeWindComponents, describeWindComponents } from "@/lib/wind-component";
import type { StationMarker } from "@/components/weather-map";

const WeatherMap = dynamic(() => import("@/components/weather-map"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Loading map…</div>,
});

interface HourlyForecastPoint {
  time: string;
  tempF: number | null;
  windSpeedMph: number | null;
  precipProbabilityPct: number | null;
}

interface WeatherResponse {
  location: { lat: number; lng: number };
  tempF: number | null;
  tempSource: "stations" | "open-meteo" | null;
  humidityPct: number | null;
  aqiPm25: number | null;
  stationCount: number;
  nearestStationDistanceMi: number | null;
  searchRadiusMi: number | null;
  feelsLikeF: number | null;
  wind: {
    speedMph: number | null;
    directionDeg: number | null;
    gustMph: number | null;
    source: "ndbc" | "open-meteo" | null;
  } | null;
  hourly: HourlyForecastPoint[];
  elevation: { targetFt: number | null; nearestStationFt: number | null; gapFt: number | null; flagged: boolean };
  fog: { likely: boolean; shortForecast: string | null } | null;
  alerts: { event: string; headline: string }[];
  sources: string[];
}

const PRESETS = [
  { label: "Sunset / Ocean Beach", lat: 37.7594, lng: -122.5107 },
  { label: "Richmond District", lat: 37.7806, lng: -122.4644 },
  { label: "Mission District", lat: 37.7599, lng: -122.4148 },
  { label: "Downtown / SOMA", lat: 37.7749, lng: -122.4194 },
  { label: "Twin Peaks", lat: 37.7544, lng: -122.4477 },
  { label: "Golden Gate Bridge", lat: 37.8079, lng: -122.4783 },
  { label: "Marin Headlands (Hawk Hill)", lat: 37.8324, lng: -122.4934 },
  { label: "Sausalito", lat: 37.8591, lng: -122.4853 },
  { label: "Tiburon", lat: 37.8735, lng: -122.4569 },
  { label: "Fairfax", lat: 37.9873, lng: -122.5881 },
  { label: "Stinson Beach", lat: 37.8999, lng: -122.6402 },
  { label: "Pantoll (Mt. Tam)", lat: 37.9061, lng: -122.6083 },
  { label: "Mt. Tamalpais", lat: 37.9235, lng: -122.5965 },
];

const DEFAULT_MAP_CENTER = { lat: 37.7749, lng: -122.4194 }; // San Francisco

export default function Home() {
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [stationMarkers, setStationMarkers] = useState<StationMarker[]>([]);

  const [destData, setDestData] = useState<WeatherResponse | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  async function loadWeather(targetLat: number, targetLng: number) {
    setLoading(true);
    setError(null);
    setSelectedPoint({ lat: targetLat, lng: targetLng });
    setDestData(null); // start point changed; any prior comparison is stale
    try {
      const [weatherRes, stationsRes] = await Promise.all([
        fetch(`/api/weather?lat=${targetLat}&lng=${targetLng}`),
        fetch(`/api/stations?lat=${targetLat}&lng=${targetLng}&radius=3`),
      ]);
      const body = await weatherRes.json();
      if (!weatherRes.ok) throw new Error(body.error ?? `Request failed (${weatherRes.status})`);
      setData(body);

      if (stationsRes.ok) {
        const stationsBody = await stationsRes.json();
        setStationMarkers(stationsBody.stations ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load weather");
      setData(null); // stale data would be misleading after a failed refetch
    } finally {
      setLoading(false);
    }
  }

  function handleMapClick(clickLat: number, clickLng: number) {
    loadWeather(clickLat, clickLng);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        loadWeather(position.coords.latitude, position.coords.longitude);
      },
      (geoError) => {
        setLoading(false);
        setError(`Location error: ${geoError.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function loadDestination(targetLat: number, targetLng: number) {
    if (!data) {
      setCompareError("Pick a start point above first.");
      return;
    }
    setCompareLoading(true);
    setCompareError(null);
    try {
      const res = await fetch(`/api/weather?lat=${targetLat}&lng=${targetLng}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setDestData(body);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : "Failed to load destination weather");
      setDestData(null);
    } finally {
      setCompareLoading(false);
    }
  }

  const comparison = (() => {
    if (
      data == null ||
      destData == null ||
      data.wind?.speedMph == null ||
      data.wind.directionDeg == null ||
      destData.wind?.speedMph == null ||
      destData.wind.directionDeg == null
    ) {
      return null;
    }

    const outBearing = bearingDeg(
      data.location.lat,
      data.location.lng,
      destData.location.lat,
      destData.location.lng
    );
    const returnBearing = (outBearing + 180) % 360;
    const outWind = computeWindComponents(data.wind.directionDeg, data.wind.speedMph, outBearing);
    const returnWind = computeWindComponents(destData.wind.directionDeg, destData.wind.speedMph, returnBearing);

    const worstFeelsLike =
      data.feelsLikeF != null && destData.feelsLikeF != null
        ? Math.min(data.feelsLikeF, destData.feelsLikeF)
        : (data.feelsLikeF ?? destData.feelsLikeF);
    const worstWind = Math.max(data.wind.speedMph, destData.wind.speedMph);

    return { outBearing, returnBearing, outWind, returnWind, kit: kitRecommendation(worstFeelsLike, worstWind) };
  })();

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Fogcast</h1>
        <p>
          One city with dozens of microclimates. SF changes its mind about
          the weather every hour and every couple blocks. We&apos;re keeping
          tabs in real-time so you don&apos;t have to.
        </p>

        <button className={styles.primaryButton} onClick={useMyLocation} disabled={loading}>
          {loading ? "Locating…" : "Use my location"}
        </button>

        <div className={styles.presets}>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              className={styles.presetButton}
              onClick={() => loadWeather(preset.lat, preset.lng)}
              disabled={loading}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className={styles.mapWrapper}>
          <WeatherMap
            center={selectedPoint ?? DEFAULT_MAP_CENTER}
            pin={selectedPoint}
            stations={stationMarkers}
            onMapClick={handleMapClick}
          />
        </div>
        <div className={styles.mapHint}>
          Click or tap anywhere on the map to drop a pin and see the weather there. Scroll or use
          the +/− controls to zoom.
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {loading && !data && (
          <div className={styles.results}>
            <div className={styles.loadingText}>Loading weather…</div>
          </div>
        )}

        {data && data.alerts.length > 0 && (
          <div className={styles.alertBanner}>
            {data.alerts.map((a) => (
              <div key={a.headline}>{a.headline}</div>
            ))}
          </div>
        )}

        {data && (
          <div className={`${styles.results} ${loading ? styles.resultsLoading : ""}`}>
            <div className={styles.tempRow}>
              <div className={styles.tempBig}>
                {data.tempF != null ? `${data.tempF.toFixed(1)}°F` : "No data"}
              </div>
              {data.feelsLikeF != null && data.feelsLikeF !== data.tempF && (
                <div className={styles.feelsLike}>Feels like {data.feelsLikeF.toFixed(0)}°F</div>
              )}
            </div>
            <div className={styles.grid}>
              <div className={styles.gridItem}>
                <span className={styles.label}>Humidity</span>
                <span>{data.humidityPct != null ? `${data.humidityPct}%` : "—"}</span>
              </div>
              <div className={styles.gridItem}>
                <span className={styles.label}>
                  Wind{data.wind?.source === "ndbc" ? " (Golden Gate station)" : ""}
                </span>
                <span>
                  {data.wind?.speedMph != null
                    ? `${Math.round(data.wind.speedMph)} mph${
                        data.wind.directionDeg != null ? ` ${degreesToCompass(data.wind.directionDeg)}` : ""
                      }`
                    : "—"}
                </span>
              </div>
              <div className={styles.gridItem}>
                <span className={styles.label}>Gusts</span>
                <span>{data.wind?.gustMph != null ? `${Math.round(data.wind.gustMph)} mph` : "—"}</span>
              </div>
              <div className={styles.gridItem}>
                <span className={styles.label}>Kit</span>
                <span>{kitRecommendation(data.feelsLikeF, data.wind?.speedMph ?? null)}</span>
              </div>
            </div>

            {data.hourly.length > 0 && (
              <div className={styles.hourlyStrip}>
                {data.hourly.slice(0, 8).map((h) => (
                  <div key={h.time} className={styles.hourlyItem}>
                    <span className={styles.label}>
                      {new Date(h.time).toLocaleTimeString([], { hour: "numeric" })}
                    </span>
                    <span>{h.tempF != null ? `${Math.round(h.tempF)}°` : "—"}</span>
                    <span className={styles.hourlyWind}>
                      {h.windSpeedMph != null ? `${Math.round(h.windSpeedMph)} mph` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {data.fog?.likely && (
              <div className={styles.fogFlag}>
                Fog likely{data.fog.shortForecast ? ` — ${data.fog.shortForecast}` : ""}
              </div>
            )}

            {data.elevation.flagged && data.elevation.gapFt != null && (
              <div className={styles.elevationFlag}>
                Nearest station is {Math.abs(data.elevation.gapFt)} ft{" "}
                {data.elevation.gapFt > 0 ? "below" : "above"} this point — temperature adjusted
                using a standard lapse rate.
              </div>
            )}

            <div className={styles.status}>
              {data.stationCount} station{data.stationCount === 1 ? "" : "s"}
              {data.searchRadiusMi != null && ` within ${data.searchRadiusMi} mi`}
              {data.nearestStationDistanceMi != null &&
                ` · nearest ${data.nearestStationDistanceMi} mi away`}
              {data.tempSource === "open-meteo" && " · temp from Open-Meteo model (no nearby stations)"}
            </div>
          </div>
        )}

        {data && (
          <div className={styles.compareSection}>
            <h2 className={styles.compareTitle}>Compare to a destination</h2>
            <p className={styles.compareHint}>
              See conditions at the other end of your ride and the headwind/tailwind for the way
              out and back.
            </p>

            <div className={styles.presets}>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  className={styles.presetButton}
                  onClick={() => loadDestination(preset.lat, preset.lng)}
                  disabled={compareLoading}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {compareLoading && <div className={styles.loadingText}>Comparing…</div>}
            {compareError && <div className={styles.error}>{compareError}</div>}

            {destData && (
              <div className={`${styles.compareGrid} ${compareLoading ? styles.resultsLoading : ""}`}>
                <div className={styles.compareCard}>
                  <span className={styles.label}>Start</span>
                  <div className={styles.compareTemp}>
                    {data.tempF != null ? `${data.tempF.toFixed(0)}°F` : "—"}
                  </div>
                  <span>
                    Feels {data.feelsLikeF != null ? `${data.feelsLikeF.toFixed(0)}°F` : "—"}
                    {data.fog?.likely ? " · fog likely" : ""}
                  </span>
                </div>
                <div className={styles.compareCard}>
                  <span className={styles.label}>Destination</span>
                  <div className={styles.compareTemp}>
                    {destData.tempF != null ? `${destData.tempF.toFixed(0)}°F` : "—"}
                  </div>
                  <span>
                    Feels {destData.feelsLikeF != null ? `${destData.feelsLikeF.toFixed(0)}°F` : "—"}
                    {destData.fog?.likely ? " · fog likely" : ""}
                  </span>
                </div>
              </div>
            )}

            {comparison && (
              <div className={styles.compareWind}>
                <div>
                  Heading {degreesToCompass(comparison.outBearing)} out:{" "}
                  {describeWindComponents(comparison.outWind)}
                </div>
                <div>
                  Heading {degreesToCompass(comparison.returnBearing)} back:{" "}
                  {describeWindComponents(comparison.returnWind)}
                </div>
                <div className={styles.compareKit}>Pack: {comparison.kit}</div>
              </div>
            )}
          </div>
        )}

        <footer className={styles.footer}>
          Temperature and humidity from PurpleAir sensors, corrected for
          known sensor bias (raw temperature −8°F, raw humidity +4%). Wind
          and forecast data by Open-Meteo.com (CC BY 4.0). Golden Gate wind
          and forecast/advisory data courtesy of NOAA/NWS and NDBC.
        </footer>
      </main>
    </div>
  );
}
