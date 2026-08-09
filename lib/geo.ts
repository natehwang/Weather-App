const EARTH_RADIUS_MI = 3958.8;
const MI_PER_DEGREE_LAT = 69.0;

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MI * c;
}

export interface BoundingBox {
  nwLat: number;
  nwLng: number;
  seLat: number;
  seLng: number;
}

/** Rough equirectangular bounding box; fine at the city-block scale this app operates at. */
export function boundingBoxFromRadiusMi(lat: number, lng: number, radiusMi: number): BoundingBox {
  const latDelta = radiusMi / MI_PER_DEGREE_LAT;
  const lngDelta = radiusMi / (MI_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
  return {
    nwLat: lat + latDelta,
    nwLng: lng - lngDelta,
    seLat: lat - latDelta,
    seLng: lng + lngDelta,
  };
}

/** Initial great-circle bearing from point 1 to point 2, in degrees (0=N, 90=E). */
export function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lng2 - lng1);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
