"use client";

/** Minimal SVG radar/spider chart for solar parameter risk. */
export default function Radar({
  axes,
  color = "var(--color-solar-400)",
  size = 220,
}: {
  axes: { label: string; value: number }[]; // value 0..1
  color?: string;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;
  const n = axes.length;

  const point = (i: number, val: number) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(ang) * r * val, cy + Math.sin(ang) * r * val] as const;
  };

  const ring = (val: number) =>
    axes.map((_, i) => point(i, val).join(",")).join(" ");
  const shape = axes.map((a, i) => point(i, Math.max(0.04, a.value)).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", maxWidth: size }}>
      {[0.25, 0.5, 0.75, 1].map((v) => (
        <polygon
          key={v}
          points={ring(v)}
          fill="none"
          stroke="var(--color-panel-border)"
          strokeWidth="1"
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-panel-border)" strokeWidth="1" />;
      })}
      <polygon points={shape} fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1.6" />
      {axes.map((a, i) => {
        const [x, y] = point(i, 1.16);
        return (
          <text
            key={a.label}
            x={x}
            y={y}
            fontSize="9"
            fill="var(--color-ink-muted)"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}
