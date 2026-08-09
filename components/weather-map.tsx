"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import { tempToColor } from "@/lib/temp-color";
import "leaflet/dist/leaflet.css";

export interface StationMarker {
  id: string;
  lat: number;
  lng: number;
  tempF: number | null;
  sourceType: string;
}

interface WeatherMapProps {
  center: { lat: number; lng: number };
  pin: { lat: number; lng: number } | null;
  stations: StationMarker[];
  onMapClick: (lat: number, lng: number) => void;
}

const pinIcon = L.divIcon({
  html: `<svg width="32" height="32" viewBox="0 0 24 24">
    <path d="M12 0C7.03 0 3 4.03 3 9c0 6.75 9 15 9 15s9-8.25 9-15c0-4.97-4.03-9-9-9z" fill="#111" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="9" r="3.2" fill="white"/>
  </svg>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function RecenterMap({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom());
  }, [center.lat, center.lng, map]);
  return null;
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function WeatherMap({ center, pin, stations, onMapClick }: WeatherMapProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={12}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RecenterMap center={center} />
      <ClickHandler onMapClick={onMapClick} />
      {stations.map((s) =>
        s.tempF != null ? (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={7}
            pathOptions={{
              color: tempToColor(s.tempF),
              fillColor: tempToColor(s.tempF),
              fillOpacity: 0.85,
              weight: 1,
            }}
          >
            <Popup>
              {s.sourceType} · {s.tempF.toFixed(1)}°F
            </Popup>
          </CircleMarker>
        ) : null
      )}
      {pin && <Marker position={[pin.lat, pin.lng]} icon={pinIcon} />}
    </MapContainer>
  );
}
