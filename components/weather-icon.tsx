export type WeatherIconCondition = "sunny" | "partly-cloudy" | "cloudy" | "foggy" | "windy";

interface WeatherIconProps {
  condition: WeatherIconCondition;
  size?: number;
}

const RAY_ANGLES_DEG = [0, 45, 90, 135, 180, 225, 270, 315];

function sunRays(cx: number, cy: number, rInner: number, rOuter: number) {
  return RAY_ANGLES_DEG.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const x1 = cx + rInner * Math.cos(rad);
    const y1 = cy + rInner * Math.sin(rad);
    const x2 = cx + rOuter * Math.cos(rad);
    const y2 = cy + rOuter * Math.sin(rad);
    return { x1, y1, x2, y2 };
  });
}

function Sun({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      {sunRays(cx, cy, r + 3, r + 9).map((line, i) => (
        <line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="#f5b342"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ))}
      <circle cx={cx} cy={cy} r={r} fill="#ffc94d" />
      <circle cx={cx - r * 0.35} cy={cy - r * 0.1} r={r * 0.11} fill="#7a4a00" />
      <circle cx={cx + r * 0.35} cy={cy - r * 0.1} r={r * 0.11} fill="#7a4a00" />
      <path
        d={`M${cx - r * 0.35} ${cy + r * 0.25} Q${cx} ${cy + r * 0.55} ${cx + r * 0.35} ${cy + r * 0.25}`}
        stroke="#7a4a00"
        strokeWidth={r * 0.11}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

function Cloud({
  cx,
  cy,
  scale = 1,
  fill = "#ffffff",
  sleepy = false,
}: {
  cx: number;
  cy: number;
  scale?: number;
  fill?: string;
  sleepy?: boolean;
}) {
  const eyeColor = "#5b6b7a";
  return (
    <g>
      <ellipse cx={cx} cy={cy + 6 * scale} rx={17 * scale} ry={10 * scale} fill={fill} />
      <circle cx={cx - 11 * scale} cy={cy + 1 * scale} r={8 * scale} fill={fill} />
      <circle cx={cx} cy={cy - 4 * scale} r={10.5 * scale} fill={fill} />
      <circle cx={cx + 11 * scale} cy={cy + 1 * scale} r={8 * scale} fill={fill} />
      {sleepy ? (
        <>
          <path
            d={`M${cx - 6 * scale} ${cy + 4 * scale} q${2 * scale} ${2 * scale} ${4 * scale} 0`}
            stroke={eyeColor}
            strokeWidth={1.6 * scale}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`M${cx + 2 * scale} ${cy + 4 * scale} q${2 * scale} ${2 * scale} ${4 * scale} 0`}
            stroke={eyeColor}
            strokeWidth={1.6 * scale}
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx={cx - 4 * scale} cy={cy + 5 * scale} r={1.6 * scale} fill={eyeColor} />
          <circle cx={cx + 4 * scale} cy={cy + 5 * scale} r={1.6 * scale} fill={eyeColor} />
          <path
            d={`M${cx - 3 * scale} ${cy + 8.5 * scale} q${3 * scale} ${2.5 * scale} ${6 * scale} 0`}
            stroke={eyeColor}
            strokeWidth={1.4 * scale}
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}
    </g>
  );
}

function MistLines({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g stroke="#9fb3c2" strokeWidth={2} strokeLinecap="round">
      <line x1={cx - 15} y1={cy} x2={cx + 15} y2={cy} />
      <line x1={cx - 11} y1={cy + 6} x2={cx + 19} y2={cy + 6} />
      <line x1={cx - 17} y1={cy + 12} x2={cx + 9} y2={cy + 12} />
    </g>
  );
}

function WindLines({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g stroke="#5b9bd5" strokeWidth={2} strokeLinecap="round" fill="none">
      <path d={`M${cx - 20} ${cy} h20 q4 0 4 -4`} />
      <path d={`M${cx - 20} ${cy + 6} h26 q4 0 4 4`} />
    </g>
  );
}

export default function WeatherIcon({ condition, size = 64 }: WeatherIconProps) {
  const cx = 32;
  const cy = 32;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {condition === "sunny" && <Sun cx={cx} cy={cy} r={16} />}

      {condition === "partly-cloudy" && (
        <>
          <Sun cx={cx + 4} cy={cy - 6} r={11} />
          <Cloud cx={cx - 2} cy={cy + 10} scale={0.95} />
        </>
      )}

      {condition === "cloudy" && <Cloud cx={cx} cy={cy} scale={1.25} fill="#e3e8ec" />}

      {condition === "foggy" && (
        <>
          <Cloud cx={cx} cy={cy - 6} scale={1.05} fill="#dbe3e8" sleepy />
          <MistLines cx={cx} cy={cy + 20} />
        </>
      )}

      {condition === "windy" && (
        <>
          <Cloud cx={cx - 2} cy={cy - 4} scale={1.05} fill="#eaf1f8" />
          <WindLines cx={cx - 4} cy={cy + 16} />
        </>
      )}
    </svg>
  );
}
