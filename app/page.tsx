"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import styles from "./page.module.css";
import { degreesToCompass } from "@/lib/compass";
import { kitRecommendation } from "@/lib/kit";
import { bearingDeg } from "@/lib/geo";
import { computeWindComponents, describeWindComponents } from "@/lib/wind-component";
import { timeOfDayGreeting } from "@/lib/greeting";
import { tempColorStops } from "@/lib/temp-color";
import WeatherIcon, { type WeatherIconCondition } from "@/components/weather-icon";
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
  conditionCode: WeatherIconCondition;
}

interface WeatherResponse {
  location: { lat: number; lng: number };
  tempF: number | null;
  tempSource: "stations" | "open-meteo" | null;
  conditionCode: WeatherIconCondition;
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
const LEGEND_STOPS = tempColorStops(5).slice().reverse(); // hottest first, for top-to-bottom display

export default function Home() {
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [pointLabel, setPointLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [stationMarkers, setStationMarkers] = useState<StationMarker[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const [destData, setDestData] = useState<WeatherResponse | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [selectedDestPreset, setSelectedDestPreset] = useState<string | null>(null);

  // On mobile, default to the Golden Gate Bridge point on first load so
  // there's something on screen without requiring a tap first.
  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 480px)").matches;
    if (!isMobile) return;
    const goldenGate = PRESETS.find((p) => p.label === "Golden Gate Bridge");
    if (goldenGate) loadWeather(goldenGate.lat, goldenGate.lng, { presetLabel: goldenGate.label });
  }, []);

  async function loadWeather(
    targetLat: number,
    targetLng: number,
    opts: { presetLabel?: string | null; displayLabel?: string } = {}
  ) {
    setLoading(true);
    setError(null);
    setSelectedPoint({ lat: targetLat, lng: targetLng });
    setSelectedPreset(opts.presetLabel ?? null);
    setPointLabel(opts.displayLabel ?? opts.presetLabel ?? null);
    setDestData(null); // start point changed; any prior comparison is stale
    setSelectedDestPreset(null);
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
    loadWeather(clickLat, clickLng, { displayLabel: "Pinned location" });
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        loadWeather(position.coords.latitude, position.coords.longitude, { displayLabel: "My location" });
      },
      (geoError) => {
        setLocating(false);
        let message = "Could not determine your location. Try a preset or tap the map instead.";
        if (geoError.code === geoError.PERMISSION_DENIED) {
          message =
            "Location access is blocked. Enable location permission for this site in your browser/phone settings, then try again.";
        } else if (geoError.code === geoError.TIMEOUT) {
          message = "Location request timed out. Try again, or make sure location services are on.";
        }
        setError(message);
      },
      // High accuracy (GPS) is often what makes mobile location hang or
      // time out indoors; network-based positioning is faster and plenty
      // precise for this app's multi-mile search radius. Allow a recent
      // cached fix so it can resolve near-instantly when one exists.
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 5 * 60 * 1000 }
    );
  }

  async function loadDestination(targetLat: number, targetLng: number, presetLabel: string) {
    if (!data) {
      setCompareError("Pick a start point above first.");
      return;
    }
    setCompareLoading(true);
    setCompareError(null);
    setSelectedDestPreset(presetLabel);
    try {
      const res = await fetch(`/api/weather?lat=${targetLat}&lng=${targetLng}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setDestData(body);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : "Failed to load destination weather");
      setDestData(null);
      setSelectedDestPreset(null);
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
        <header className={styles.hero}>
          <div className={styles.heroSky} aria-hidden="true">
            <svg viewBox="0 0 400 90" preserveAspectRatio="none" className={styles.heroSkyline}>
              <path d="M0 90 L0 55 Q100 30 200 50 T400 45 L400 90 Z" fill="var(--hill-color)" />
              <g stroke="var(--bridge-color)" strokeWidth="3" fill="none" strokeLinecap="round">
                <path d="M300 60 L300 20 M340 60 L340 20" />
                <path d="M280 40 Q320 15 360 40" />
                <path d="M300 22 L300 40 M310 26 L310 42 M320 22 L320 42 M330 26 L330 42 M340 22 L340 40" />
              </g>
            </svg>
          </div>
          <div className={styles.heroContent}>
            <div>
              <h1>{timeOfDayGreeting()}</h1>
              <p>
                Exact conditions, hyperlocal. Because the Bay has microclimates —
                and Fogcast keeps tabs in real time so you don&apos;t have to.
              </p>
            </div>
            <div className={styles.heroMascot}>
              <WeatherIcon condition="partly-cloudy" size={64} />
            </div>
          </div>
        </header>

        <button className={styles.primaryButton} onClick={useMyLocation} disabled={locating}>
          {locating ? "Locating…" : "Use my location"}
        </button>

        <div className={styles.presets}>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              className={`${styles.presetButton} ${
                selectedPreset === preset.label ? styles.presetButtonActive : ""
              }`}
              onClick={() => loadWeather(preset.lat, preset.lng, { presetLabel: preset.label })}
              disabled={loading}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className={styles.mapCard}>
          <div className={styles.mapWrapper}>
            <WeatherMap
              center={selectedPoint ?? DEFAULT_MAP_CENTER}
              pin={selectedPoint}
              stations={stationMarkers}
              onMapClick={handleMapClick}
            />
          </div>

          <div className={styles.mapLegend}>
            <div className={styles.legendHeader}>
              <span className={styles.legendDot} /> Live conditions
            </div>
            <div className={styles.legendSubhead}>Temp (°F)</div>
            <div className={styles.legendBarRow}>
              <div
                className={styles.legendBar}
                style={{
                  background: `linear-gradient(to bottom, ${LEGEND_STOPS.map((s) => s.color).join(", ")})`,
                }}
              />
              <div className={styles.legendTicks}>
                {LEGEND_STOPS.map((s) => (
                  <span key={s.tempF}>{s.tempF}°</span>
                ))}
              </div>
            </div>
          </div>

          <button
            className={styles.mapLocateButton}
            onClick={useMyLocation}
            disabled={locating}
            aria-label="Use my location"
            title="Use my location"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2 L21 12 L12 22 L3 12 Z" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
            </svg>
          </button>
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
            <div className={styles.conditionsTop}>
              <div className={styles.conditionsLeft}>
                <WeatherIcon condition={data.conditionCode} size={56} />
                <div>
                  <div className={styles.tempBig}>
                    {data.tempF != null ? `${data.tempF.toFixed(1)}°` : "—"}
                  </div>
                  {data.feelsLikeF != null && data.feelsLikeF !== data.tempF && (
                    <div className={styles.feelsLike}>Feels like {data.feelsLikeF.toFixed(0)}°F</div>
                  )}
                  <div className={styles.freshnessBadge}>
                    <span className={styles.freshnessDot} /> Updated just now
                  </div>
                </div>
              </div>
              <div className={styles.conditionsRight}>
                <div className={styles.pointLabel}>{pointLabel ?? "Selected location"}</div>
                <div className={styles.elevationLabel}>
                  Elev. {data.elevation.targetFt != null ? `${data.elevation.targetFt} ft` : "—"}
                </div>
                <div className={styles.windReadout}>
                  <span className={styles.windLabel}>
                    Wind{data.wind?.source === "ndbc" ? " (Golden Gate station)" : ""}
                  </span>
                  <span className={styles.windValue}>
                    {data.wind?.speedMph != null
                      ? `${Math.round(data.wind.speedMph)} mph${
                          data.wind.directionDeg != null ? ` ${degreesToCompass(data.wind.directionDeg)}` : ""
                        }`
                      : "—"}
                  </span>
                  {data.wind?.gustMph != null && (
                    <span className={styles.gustValue}>Gusting to {Math.round(data.wind.gustMph)} mph</span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.grid}>
              <div className={styles.gridItem}>
                <span className={styles.label}>Humidity</span>
                <span>{data.humidityPct != null ? `${data.humidityPct}%` : "—"}</span>
              </div>
              <div className={styles.gridItem}>
                <span className={styles.label}>Kit</span>
                <span>{kitRecommendation(data.feelsLikeF, data.wind?.speedMph ?? null)}</span>
              </div>
            </div>

            {data.hourly.length > 0 && (
              <div className={styles.hourlySection}>
                <div className={styles.hourlySectionHeader}>Next few hours</div>
                <div className={styles.hourlyStrip}>
                  {data.hourly.slice(0, 8).map((h) => (
                    <div key={h.time} className={styles.hourlyItem}>
                      <span className={styles.label}>
                        {new Date(h.time).toLocaleTimeString([], { hour: "numeric" })}
                      </span>
                      <WeatherIcon condition={h.conditionCode} size={28} />
                      <span>{h.tempF != null ? `${Math.round(h.tempF)}°` : "—"}</span>
                      <span className={styles.hourlyWind}>
                        {h.windSpeedMph != null ? `${Math.round(h.windSpeedMph)} mph` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
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
                  className={`${styles.presetButton} ${
                    selectedDestPreset === preset.label ? styles.presetButtonActive : ""
                  }`}
                  onClick={() => loadDestination(preset.lat, preset.lng, preset.label)}
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
                  <WeatherIcon condition={data.conditionCode} size={32} />
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
                  <WeatherIcon condition={destData.conditionCode} size={32} />
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
