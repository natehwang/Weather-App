import { NextRequest, NextResponse } from "next/server";
import { fetchNearbyStations } from "@/lib/aggregate";
import { blendObservations } from "@/lib/interpolate";
import { getOpenMeteoForecast } from "@/lib/providers/open-meteo";
import { windChillF } from "@/lib/wind-chill";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng query params are required" }, { status: 400 });
  }

  if (!process.env.PURPLEAIR_API_KEY) {
    return NextResponse.json(
      { error: "PURPLEAIR_API_KEY is not configured on the server. Add it to .env.local." },
      { status: 500 }
    );
  }

  const [stationsResult, openMeteoResult] = await Promise.allSettled([
    fetchNearbyStations(lat, lng),
    getOpenMeteoForecast(lat, lng),
  ]);

  if (stationsResult.status === "rejected" && openMeteoResult.status === "rejected") {
    return NextResponse.json({ error: "All weather providers failed to respond" }, { status: 502 });
  }

  const stations = stationsResult.status === "fulfilled" ? stationsResult.value.stations : [];
  const radiusUsedMi = stationsResult.status === "fulfilled" ? stationsResult.value.radiusUsedMi : null;
  const openMeteo = openMeteoResult.status === "fulfilled" ? openMeteoResult.value : null;

  const blended = blendObservations(stations, lat, lng);

  // Prefer station-interpolated temp; fall back to the Open-Meteo model point
  // when no nearby stations reported (e.g. deep in the Headlands).
  const tempF = blended.tempF ?? openMeteo?.tempF ?? null;
  const tempSource: "stations" | "open-meteo" | null =
    blended.tempF != null ? "stations" : openMeteo?.tempF != null ? "open-meteo" : null;

  const windSpeedMph = openMeteo?.windSpeedMph ?? null;
  const feelsLikeF =
    tempF != null && windSpeedMph != null ? Math.round(windChillF(tempF, windSpeedMph) * 10) / 10 : tempF;

  return NextResponse.json({
    location: { lat, lng },
    tempF,
    tempSource,
    humidityPct: blended.humidityPct,
    aqiPm25: blended.aqiPm25,
    stationCount: blended.stationCount,
    nearestStationDistanceMi:
      blended.nearestStationDistanceMi != null ? Math.round(blended.nearestStationDistanceMi * 100) / 100 : null,
    searchRadiusMi: radiusUsedMi,
    feelsLikeF,
    wind: openMeteo
      ? {
          speedMph: openMeteo.windSpeedMph,
          directionDeg: openMeteo.windDirectionDeg,
          gustMph: openMeteo.windGustMph,
        }
      : null,
    hourly: openMeteo?.hourly ?? [],
    sources: [
      ...(stations.length > 0 ? ["purpleair"] : []),
      ...(openMeteo ? ["open-meteo"] : []),
    ],
  });
}
