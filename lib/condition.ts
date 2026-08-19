export type ConditionCode = "sunny" | "partly-cloudy" | "cloudy" | "foggy" | "windy";

const WINDY_THRESHOLD_MPH = 18;

export function resolveCondition(opts: {
  fogLikely?: boolean;
  cloudCoverPct: number | null;
  windMph?: number | null;
}): ConditionCode {
  if (opts.fogLikely) return "foggy";
  if (opts.windMph != null && opts.windMph > WINDY_THRESHOLD_MPH) return "windy";
  if (opts.cloudCoverPct == null) return "partly-cloudy";
  if (opts.cloudCoverPct < 25) return "sunny";
  if (opts.cloudCoverPct < 60) return "partly-cloudy";
  return "cloudy";
}
