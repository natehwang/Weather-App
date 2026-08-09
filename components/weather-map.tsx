"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from "react-leaflet";
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
  stations: StationMarker[];
  onMapClick: (lat: number, lng: number) => void;
}

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

export default function WeatherMap({ center, stations, onMapClick }: WeatherMapProps) {
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
    </MapContainer>
  );
}
