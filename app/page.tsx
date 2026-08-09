"use client";

import { useState, type FormEvent } from "react";
import styles from "./page.module.css";
import { aqiCategory } from "@/lib/aqi";
import { degreesToCompass } from "@/lib/compass";

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
  { label: "Mission District", lat: 37.7599, lng: -122.4148 },
  { label: "Downtown / SOMA", lat: 37.7749, lng: -122.4194 },
  { label: "Marin Headlands (Hawk Hill)", lat: 37.8324, lng: -122.4934 },
  { label: "Mt. Tamalpais", lat: 37.9235, lng: -122.5965 },
];

export default function Home() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadWeather(targetLat: number, targetLng: number) {
    setLoading(true);
    setError(null);
    setData(null);
    setLat(String(targetLat));
    setLng(String(targetLng));
    try {
      const res = await fetch(`/api/weather?lat=${targetLat}&lng=${targetLng}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load weather");
    } finally {
      setLoading(false);
    }
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

  function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      setError("Enter valid latitude and longitude.");
      return;
    }
    loadWeather(parsedLat, parsedLng);
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>SF Microclimate Weather</h1>
        <p>
          Hyperlocal temperature, humidity, and air quality blended from
          nearby PurpleAir sensors, corrected for the sensors&apos; known
          temperature/humidity bias.
        </p>

        <button className={styles.primaryButton} onClick={useMyLocation} disabled={loading}>
          {loading ? "Locating…" : "Use my location"}
        </button>

        <form className={styles.manualForm} onSubmit={handleManualSubmit}>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Latitude"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
          />
          <input
            type="text"
            inputMode="decimal"
            placeholder="Longitude"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            Get weather
          </button>
        </form>

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

        {error && <div className={styles.error}>{error}</div>}

        {data && data.alerts.length > 0 && (
          <div className={styles.alertBanner}>
            {data.alerts.map((a) => (
              <div key={a.headline}>{a.headline}</div>
            ))}
          </div>
        )}

        {data && (
          <div className={styles.results}>
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
                <span className={styles.label}>AQI (PM2.5)</span>
                <span>
                  {data.aqiPm25 != null ? `${data.aqiPm25} (${aqiCategory(data.aqiPm25)})` : "—"}
                </span>
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

        <footer className={styles.footer}>
          Temperature, humidity, and AQI from PurpleAir sensors, corrected
          for known sensor bias (raw temperature −8°F, raw humidity +4%). Wind
          and forecast data by Open-Meteo.com (CC BY 4.0). Golden Gate wind
          and forecast/advisory data courtesy of NOAA/NWS and NDBC.
        </footer>
      </main>
    </div>
  );
}
