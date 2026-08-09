import { NextRequest, NextResponse } from "next/server";
import { purpleAirProvider } from "@/lib/providers/purpleair";
import { ndbcProvider } from "@/lib/providers/ndbc";

const DEFAULT_RADIUS_MI = 3;
const RECENCY_WINDOW_SEC = 60 * 60;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const radiusMi = Number(searchParams.get("radius")) || DEFAULT_RADIUS_MI;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng query params are required" }, { status: 400 });
  }

  if (!process.env.PURPLEAIR_API_KEY) {
    return NextResponse.json(
      { error: "PURPLEAIR_API_KEY is not configured on the server. Add it to .env.local." },
      { status: 500 }
    );
  }

  const [purpleAirResult, ndbcResult] = await Promise.allSettled([
    purpleAirProvider.getNearbyObservations(lat, lng, radiusMi),
    ndbcProvider.getNearbyObservations(lat, lng, radiusMi),
  ]);

  const stations = [
    ...(purpleAirResult.status === "fulfilled" ? purpleAirResult.value : []),
    ...(ndbcResult.status === "fulfilled" ? ndbcResult.value : []),
  ];

  const nowSec = Date.now() / 1000;
  const recent = stations.filter((s) => nowSec - s.lastSeen <= RECENCY_WINDOW_SEC);

  return NextResponse.json({
    stations: recent.map((s) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      tempF: s.tempF,
      sourceType: s.sourceType,
    })),
  });
}
