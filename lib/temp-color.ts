// Blue (cold) -> red (hot) diverging scale for map markers and the legend.
export const COLD_F = 45;
export const HOT_F = 85;

export function tempToColor(tempF: number): string {
  const t = Math.max(0, Math.min(1, (tempF - COLD_F) / (HOT_F - COLD_F)));
  const hue = 220 - t * 220; // 220=blue, 0=red
  return `hsl(${hue}, 80%, 45%)`;
}

/** Evenly spaced color stops from cold to hot, for building a legend gradient. */
export function tempColorStops(steps = 5): { tempF: number; color: string }[] {
  return Array.from({ length: steps }, (_, i) => {
    const tempF = COLD_F + ((HOT_F - COLD_F) * i) / (steps - 1);
    return { tempF: Math.round(tempF), color: tempToColor(tempF) };
  });
}
