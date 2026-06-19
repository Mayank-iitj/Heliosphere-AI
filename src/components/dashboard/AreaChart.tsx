"use client";

import { useId } from "react";

/** Tiny dependency-free area/line chart. Auto-scales to the data range. */
export default function AreaChart({
  data,
  color = "var(--color-solar-400)",
  height = 120,
  fill = true,
  log = false,
}: {
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
  log?: boolean;
}) {
  const gid = useId();
  if (!data.length) return <div style={{ height }} />;

  const vals = log ? data.map((d) => Math.log10(Math.max(d, 1e-9))) : data;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 100;
  const H = 100;

  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1 || 1)) * W;
    const y = H - ((v - min) / range) * (H - 8) - 4;
    return [x, y] as const;
  });

  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height }}
      role="img"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
