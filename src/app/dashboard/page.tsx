"use client";

import { useEffect, useState } from "react";
import { api, type ForecastHorizon, type Alert } from "@/lib/api";
import { useLiveSolar, useSolarHistory, useLiveIndicator } from "@/lib/hooks";
import { MetricCard, Panel, ProbBar, RiskBadge } from "@/components/ui/primitives";
import AreaChart from "@/components/dashboard/AreaChart";
import Link from "next/link";

export default function MissionControl() {
  const { data, live }        = useLiveSolar(10_000);
  const { history }           = useSolarHistory(48, 300_000);
  const { label: srcLabel, color: srcColor, isLive } = useLiveIndicator(30_000);
  const [forecast, setForecast] = useState<ForecastHorizon[]>([]);
  const [alerts,   setAlerts]   = useState<Alert[]>([]);

  useEffect(() => {
    api.forecast().then(setForecast).catch(() => {});
    api.alerts().then(setAlerts).catch(() => {});
    const id = setInterval(() => {
      api.alerts().then(setAlerts).catch(() => {});
    }, 20_000);
    return () => clearInterval(id);
  }, []);

  const six = forecast.find((f) => f.horizon_hours === 6) ?? forecast[0];

  return (
    <div className="mx-auto max-w-7xl space-y-5">

      {/* Live data source badge */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Mission Control</h1>
        <div className="flex items-center gap-2 rounded-full border border-[var(--color-panel-border)] bg-[var(--color-space-900)]/60 px-3 py-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background: srcColor,
              boxShadow: isLive ? `0 0 6px ${srcColor}` : "none",
            }}
          />
          <span className="font-mono text-xs" style={{ color: srcColor }}>
            {srcLabel}
          </span>
          {!live && (
            <span className="text-[10px] text-[var(--color-ink-faint)]">· backend connecting</span>
          )}
        </div>
      </div>

      {/* Top metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard
          label="Kp Index"
          value={data.kp_index.toFixed(1)}
          hint={data.kp_label}
        />
        <MetricCard label="X-ray" value={data.xray_class} hint="GOES" />
        <MetricCard label="Solar Wind" value={data.solar_wind_speed} unit="km/s" />
        <MetricCard
          label="Bz (IMF)"
          value={data.bz.toFixed(1)}
          unit="nT"
          hint={data.bz < 0 ? "Southward ⚡" : "Northward"}
        />
        <MetricCard
          label="Proton Density"
          value={data.proton_density.toFixed(1)}
          unit="p/cm³"
        />
        <MetricCard label="Sunspots" value={data.sunspot_number} hint="SILSO" />
      </div>

      {/* Charts row 1 — Kp, Wind, X-ray */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="48-hour trends" subtitle="Kp · solar wind · X-ray flux">
          <div className="grid gap-5 sm:grid-cols-3">
            <ChartBlock
              label="Kp index"
              value={data.kp_index.toFixed(1)}
              data={history.map((h) => h.kp_index)}
              color="var(--color-solar-400)"
            />
            <ChartBlock
              label="Solar wind"
              value={`${data.solar_wind_speed} km/s`}
              data={history.map((h) => h.solar_wind_speed)}
              color="#7fb4ff"
            />
            <ChartBlock
              label="X-ray flux"
              value={data.xray_class}
              data={history.map((h) => h.xray_flux)}
              color="var(--color-risk-severe)"
              log
            />
          </div>
        </Panel>

        {/* Forecast summary */}
        <Panel
          title="6-hour flare outlook"
          subtitle="HelioPredict"
          action={six && <RiskBadge risk={six.severity} />}
        >
          {six ? (
            <div className="space-y-4">
              <ProbBar label="C" value={six.probabilities.C} color="var(--color-risk-low)" />
              <ProbBar label="M" value={six.probabilities.M} color="var(--color-risk-high)" />
              <ProbBar label="X" value={six.probabilities.X} color="var(--color-risk-severe)" />
              <p className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-space-900)]/60 p-3 text-xs leading-relaxed text-[var(--color-ink-muted)]">
                {six.rationale}
              </p>
              <Link
                href="/dashboard/predict"
                className="inline-block text-xs font-semibold text-[var(--color-solar-300)] hover:underline"
              >
                Full forecast →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
          )}
        </Panel>
      </div>

      {/* Charts row 2 — Bz + Proton Density */}
      <Panel title="Solar wind & IMF trends" subtitle="Bz (IMF) · proton density — 48h">
        <div className="grid gap-5 sm:grid-cols-2">
          <ChartBlock
            label="IMF Bz (nT)"
            value={`${data.bz.toFixed(1)} nT`}
            data={history.map((h) => h.bz)}
            color={data.bz < -5 ? "var(--color-risk-severe)" : "#a78bfa"}
          />
          <ChartBlock
            label="Proton density (p/cm³)"
            value={`${data.proton_density.toFixed(1)} p/cm³`}
            data={history.map((h) => h.proton_density)}
            color="#34d399"
          />
        </div>
      </Panel>

      {/* Alerts */}
      <Panel
        title="Recent alerts"
        subtitle="Autonomous HelioWatch"
        action={
          <Link
            href="/dashboard/alerts"
            className="text-xs font-semibold text-[var(--color-solar-300)] hover:underline"
          >
            View all →
          </Link>
        }
      >
        {alerts.length ? (
          <ul className="space-y-2">
            {alerts.slice(0, 5).map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-space-900)]/40 px-4 py-2.5"
              >
                <LevelDot level={a.level} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{a.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-[var(--color-ink-faint)]">
                      {formatAlertTime(a.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-[var(--color-ink-muted)]">
                    {a.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-ink-muted)]">
            No active alerts — conditions nominal.
          </p>
        )}
      </Panel>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChartBlock({
  label,
  value,
  data,
  color,
  log,
}: {
  label: string;
  value: string;
  data: number[];
  color: string;
  log?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-[var(--color-ink-muted)]">{label}</span>
        <span className="font-mono text-sm font-semibold" style={{ color }}>
          {value}
        </span>
      </div>
      <div className="mt-2">
        <AreaChart data={data} color={color} log={log} height={90} />
      </div>
    </div>
  );
}

const LEVEL_COLOR: Record<string, string> = {
  info:    "var(--color-risk-low)",
  watch:   "var(--color-risk-moderate)",
  warning: "var(--color-risk-high)",
  severe:  "var(--color-risk-severe)",
};

function LevelDot({ level }: { level: string }) {
  return (
    <span
      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
      style={{ background: LEVEL_COLOR[level] ?? "var(--color-ink-faint)" }}
    />
  );
}

function formatAlertTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    });
  } catch {
    return "—";
  }
}
