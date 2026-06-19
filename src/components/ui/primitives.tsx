"use client";

import clsx from "clsx";

export const RISK_COLOR: Record<string, string> = {
  Low: "var(--color-risk-low)",
  Moderate: "var(--color-risk-moderate)",
  High: "var(--color-risk-high)",
  Severe: "var(--color-risk-severe)",
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  quiet: { label: "Quiet Sun", color: "var(--color-risk-low)" },
  unsettled: { label: "Unsettled", color: "var(--color-risk-moderate)" },
  active: { label: "Active", color: "var(--color-risk-high)" },
  storm: { label: "Geomagnetic Storm", color: "var(--color-risk-severe)" },
};

export function StatusPill({ status, live }: { status: string; live?: boolean }) {
  const meta = STATUS_META[status] ?? STATUS_META.quiet;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-panel-border)] bg-[var(--color-space-800)]/70 px-3 py-1 text-xs font-medium tracking-wide">
      <span
        className="relative inline-flex h-2 w-2 rounded-full pulse-ring"
        style={{ color: meta.color, background: meta.color }}
      />
      <span style={{ color: meta.color }}>{meta.label}</span>
      {live !== undefined && (
        <span className="text-[var(--color-ink-faint)]">
          · {live ? "LIVE" : "DEMO"}
        </span>
      )}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: string }) {
  const color = RISK_COLOR[risk] ?? RISK_COLOR.Low;
  return (
    <span
      className="rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
      style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}
    >
      {risk}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  unit,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={clsx("glass rounded-xl p-4", className)}>
      <div className="text-[11px] uppercase tracking-widest text-[var(--color-ink-faint)]">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-mono text-2xl font-semibold text-[var(--color-ink)]">
          {value}
        </span>
        {unit && <span className="text-xs text-[var(--color-ink-muted)]">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-[var(--color-ink-muted)]">{hint}</div>}
    </div>
  );
}

export function Panel({
  children,
  className,
  title,
  subtitle,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={clsx("glass rounded-2xl p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h3 className="text-sm font-semibold tracking-wide text-[var(--color-ink)]">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{subtitle}</p>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function ProbBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number; // 0..1
  color: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-5 font-mono text-sm font-semibold" style={{ color }}>
        {label}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-space-700)]">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="w-10 text-right font-mono text-xs text-[var(--color-ink-muted)]">
        {pct}%
      </span>
    </div>
  );
}
