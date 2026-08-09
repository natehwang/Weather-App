"use client";

import { useState, type FormEvent } from "react";
import styles from "./page.module.css";
import { aqiCategory } from "@/lib/aqi";

interface WeatherResponse {
  location: { lat: number; lng: number };
  tempF: number | null;
  humidityPct: number | null;
  aqiPm25: number | null;
  stationCount: number;
  nearestStationDistanceMi: number | null;
  searchRadiusMi: number;
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

        {data && (
          <div className={styles.results}>
            <div className={styles.tempBig}>
              {data.tempF != null ? `${data.tempF.toFixed(1)}°F` : "No data"}
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
            </div>
            <div className={styles.status}>
              {data.stationCount} station{data.stationCount === 1 ? "" : "s"} within{" "}
              {data.searchRadiusMi} mi
              {data.nearestStationDistanceMi != null &&
                ` · nearest ${data.nearestStationDistanceMi} mi away`}
            </div>
          </div>
        )}

        <footer className={styles.footer}>
          Air quality and temperature data from PurpleAir sensors, corrected
          for known sensor bias (raw temperature −8°F, raw humidity +4%).
        </footer>
      </main>
    </div>
  );
}
