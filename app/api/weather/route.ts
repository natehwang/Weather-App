import { NextRequest, NextResponse } from "next/server";
import { fetchNearbyStations } from "@/lib/aggregate";
import { blendObservations } from "@/lib/interpolate";

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

  let stations;
  let radiusUsedMi;
  try {
    ({ stations, radiusUsedMi } = await fetchNearbyStations(lat, lng));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch station data" },
      { status: 502 }
    );
  }

  const blended = blendObservations(stations, lat, lng);

  return NextResponse.json({
    location: { lat, lng },
    tempF: blended.tempF,
    humidityPct: blended.humidityPct,
    aqiPm25: blended.aqiPm25,
    stationCount: blended.stationCount,
    nearestStationDistanceMi:
      blended.nearestStationDistanceMi != null ? Math.round(blended.nearestStationDistanceMi * 100) / 100 : null,
    searchRadiusMi: radiusUsedMi,
    sources: ["purpleair"],
  });
}
