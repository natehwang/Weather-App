// Blue (cold) -> red (hot) diverging scale for map markers.
const COLD_F = 45;
const HOT_F = 85;

export function tempToColor(tempF: number): string {
  const t = Math.max(0, Math.min(1, (tempF - COLD_F) / (HOT_F - COLD_F)));
  const hue = 220 - t * 220; // 220=blue, 0=red
  return `hsl(${hue}, 80%, 45%)`;
}
