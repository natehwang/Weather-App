// EPA 2012 PM2.5 breakpoints: [concLow, concHigh, aqiLow, aqiHigh]
const PM25_BREAKPOINTS: [number, number, number, number][] = [
  [0.0, 12.0, 0, 50],
  [12.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 150.4, 151, 200],
  [150.5, 250.4, 201, 300],
  [250.5, 350.4, 301, 400],
  [350.5, 500.4, 401, 500],
];

export function pm25ToAqi(pm25: number): number | null {
  if (!Number.isFinite(pm25) || pm25 < 0) return null;
  const clamped = Math.min(pm25, 500.4);
  for (const [concLow, concHigh, aqiLow, aqiHigh] of PM25_BREAKPOINTS) {
    if (clamped >= concLow && clamped <= concHigh) {
      return Math.round(((aqiHigh - aqiLow) / (concHigh - concLow)) * (clamped - concLow) + aqiLow);
    }
  }
  return 500;
}
