// NWS wind chill formula. Only valid for temp <= 50°F and wind > 3 mph;
// outside that range "feels like" is just the air temperature.
export function windChillF(tempF: number, windMph: number): number {
  if (tempF > 50 || windMph <= 3) return tempF;
  const v016 = Math.pow(windMph, 0.16);
  return 35.74 + 0.6215 * tempF - 35.75 * v016 + 0.4275 * tempF * v016;
}
