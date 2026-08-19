import { NextRequest, NextResponse } from "next/server";
import { fetchNearbyStations } from "@/lib/aggregate";
import { blendObservations, ELEVATION_FLAG_THRESHOLD_FT } from "@/lib/interpolate";
import { getOpenMeteoForecast } from "@/lib/providers/open-meteo";
import { getNwsConditions } from "@/lib/providers/nws";
import { getElevationFt } from "@/lib/elevation";
import { windChillF } from "@/lib/wind-chill";
import { resolveWind } from "@/lib/wind";
import { resolveCondition } from "@/lib/condition";

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

  const [stationsResult, openMeteoResult, nwsResult, elevationResult] = await Promise.allSettled([
    fetchNearbyStations(lat, lng),
    getOpenMeteoForecast(lat, lng),
    getNwsConditions(lat, lng),
    getElevationFt(lat, lng),
  ]);

  if (stationsResult.status === "rejected" && openMeteoResult.status === "rejected") {
    return NextResponse.json({ error: "All weather providers failed to respond" }, { status: 502 });
  }

  const stations = stationsResult.status === "fulfilled" ? stationsResult.value.stations : [];
  const radiusUsedMi = stationsResult.status === "fulfilled" ? stationsResult.value.radiusUsedMi : null;
  const openMeteo = openMeteoResult.status === "fulfilled" ? openMeteoResult.value : null;
  const nws = nwsResult.status === "fulfilled" ? nwsResult.value : null;
  const targetElevationFt = elevationResult.status === "fulfilled" ? elevationResult.value : null;

  const blended = blendObservations(stations, lat, lng, { targetElevationFt });

  // Prefer station-interpolated temp; fall back to the Open-Meteo model point
  // when no nearby stations reported (e.g. deep in the Headlands).
  const tempF = blended.tempF ?? openMeteo?.tempF ?? null;
  const tempSource: "stations" | "open-meteo" | null =
    blended.tempF != null ? "stations" : openMeteo?.tempF != null ? "open-meteo" : null;

  const wind = resolveWind(lat, lng, stations, openMeteo);
  const feelsLikeF =
    tempF != null && wind.speedMph != null ? Math.round(windChillF(tempF, wind.speedMph) * 10) / 10 : tempF;

  const elevationGapFt =
    targetElevationFt != null && blended.nearestStationElevationFt != null
      ? Math.round(targetElevationFt - blended.nearestStationElevationFt)
      : null;

  const conditionCode = resolveCondition({
    fogLikely: nws?.fogLikely,
    cloudCoverPct: openMeteo?.cloudCoverPct ?? null,
    windMph: wind.speedMph,
  });

  const hourly = (openMeteo?.hourly ?? []).map((h) => ({
    ...h,
    conditionCode: resolveCondition({ cloudCoverPct: h.cloudCoverPct, windMph: h.windSpeedMph }),
  }));

  return NextResponse.json({
    location: { lat, lng },
    tempF,
    tempSource,
    conditionCode,
    humidityPct: blended.humidityPct,
    aqiPm25: blended.aqiPm25,
    stationCount: blended.stationCount,
    nearestStationDistanceMi: blended.nearestStationDistanceMi,
    searchRadiusMi: radiusUsedMi,
    feelsLikeF,
    wind,
    hourly,
    elevation: {
      targetFt: targetElevationFt != null ? Math.round(targetElevationFt) : null,
      nearestStationFt: blended.nearestStationElevationFt,
      gapFt: elevationGapFt,
      flagged: elevationGapFt != null && Math.abs(elevationGapFt) > ELEVATION_FLAG_THRESHOLD_FT,
    },
    fog: nws ? { likely: nws.fogLikely, shortForecast: nws.shortForecast } : null,
    alerts: nws?.alerts ?? [],
    sources: [
      ...(stations.some((s) => s.sourceType === "purpleair") ? ["purpleair"] : []),
      ...(stations.some((s) => s.sourceType === "ndbc") ? ["ndbc"] : []),
      ...(openMeteo ? ["open-meteo"] : []),
      ...(nws ? ["nws"] : []),
    ],
  });
}
