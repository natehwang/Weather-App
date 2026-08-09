export interface WindComponents {
  /** Positive = tailwind, negative = headwind, along the travel bearing. */
  headTailMph: number;
  /** Positive = pushing right of travel direction, negative = pushing left. */
  crossMph: number;
}

function angleDiffDeg(a: number, b: number): number {
  return (((a - b + 180) % 360) + 360) % 360 - 180;
}

/** windFromDeg is the meteorological convention: the direction the wind blows FROM. */
export function computeWindComponents(
  windFromDeg: number,
  windSpeedMph: number,
  travelBearingDeg: number
): WindComponents {
  const windToDeg = (windFromDeg + 180) % 360;
  const diffRad = (angleDiffDeg(windToDeg, travelBearingDeg) * Math.PI) / 180;
  return {
    headTailMph: Math.round(windSpeedMph * Math.cos(diffRad) * 10) / 10,
    crossMph: Math.round(windSpeedMph * Math.sin(diffRad) * 10) / 10,
  };
}

export function describeWindComponents({ headTailMph, crossMph }: WindComponents): string {
  const parts: string[] = [];
  if (Math.abs(headTailMph) < 1) {
    parts.push("negligible headwind/tailwind");
  } else if (headTailMph > 0) {
    parts.push(`${Math.abs(headTailMph)} mph tailwind`);
  } else {
    parts.push(`${Math.abs(headTailMph)} mph headwind`);
  }
  if (Math.abs(crossMph) >= 3) {
    parts.push(`${Math.abs(crossMph)} mph crosswind`);
  }
  return parts.join(", ");
}
