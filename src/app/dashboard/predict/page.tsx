"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type ForecastHorizon, type FlareNowcast } from "@/lib/api";
import { useLiveSolar } from "@/lib/hooks";
import { Panel, ProbBar, RiskBadge } from "@/components/ui/primitives";
import Radar from "@/components/dashboard/Radar";
import clsx from "clsx";

export default function PredictPage() {
  const { data } = useLiveSolar(10000);
  const [forecast, setForecast] = useState<ForecastHorizon[]>([]);
  const [nowcast, setNowcast] = useState<FlareNowcast | null>(null);
  const [horizon, setHorizon] = useState(6);

  useEffect(() => {
    const pull = () => {
      api.forecast().then(setForecast).catch(() => {});
      api.nowcast("rf").then(setNowcast).catch(() => {});
    };
    pull();
    const id = setInterval(pull, 30000);
    return () => clearInterval(id);
  }, []);

  const active = forecast.find((f) => f.horizon_hours === horizon) ?? forecast[0];

  const radarAxes = useMemo(
    () => [
      { label: "X-ray", value: Math.min(1, (Math.log10(Math.max(data.xray_flux, 1e-9)) + 8) / 4) },
      { label: "Kp", value: data.kp_index / 9 },
      { label: "Wind", value: Math.min(1, data.solar_wind_speed / 800) },
      { label: "Density", value: Math.min(1, data.proton_density / 15) },
      { label: "|Bz|", value: Math.min(1, Math.abs(data.bz) / 20) },
      { label: "Sunspots", value: Math.min(1, data.sunspot_number / 220) },
    ],
    [data],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Horizon tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[1, 6, 24].map((h) => (
          <button
            key={h}
            onClick={() => setHorizon(h)}
            className={clsx(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              horizon === h
                ? "border-[var(--color-solar-400)] bg-[var(--color-solar-500)]/15 text-[var(--color-solar-300)]"
                : "border-[var(--color-panel-border)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]",
            )}
          >
            {h} Hour{h > 1 ? "s" : ""} Ahead
          </button>
        ))}
        <span className="ml-auto text-xs text-[var(--color-ink-muted)]">
          Ensemble + temporal model · updated continuously
        </span>
      </div>

      {/* Trained-model 30-min nowcast (Aditya-L1 SoLEXS/HELIOS) */}
      <Panel
        title="30-Minute Flare Nowcast"
        subtitle="Trained Aditya-L1 model · probability of flare onset within 30 min"
        action={
          nowcast && (
            <span
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-semibold",
                nowcast.will_flare
                  ? "bg-[var(--color-risk-severe)]/15 text-[var(--color-risk-severe)]"
                  : "bg-[var(--color-risk-low)]/15 text-[var(--color-risk-low)]",
              )}
            >
              {nowcast.will_flare ? "⚠ Flare expected" : "✓ No flare expected"}
            </span>
          )
        }
      >
        {nowcast ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <div className="font-mono text-4xl font-bold text-[var(--color-solar-300)]">
                  {Math.round(nowcast.flare_probability * 100)}%
                </div>
                <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
                  onset probability · decision threshold{" "}
                  {Math.round(nowcast.threshold * 100)}%
                </div>
              </div>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--color-space-700)]">
                <div
                  className={clsx(
                    "h-full rounded-full",
                    nowcast.will_flare
                      ? "bg-[var(--color-risk-severe)]"
                      : "bg-[var(--color-solar-400)]",
                  )}
                  style={{ width: `${Math.round(nowcast.flare_probability * 100)}%` }}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--color-panel-border)] pt-3 text-xs text-[var(--color-ink-muted)]">
              <span>
                Model:{" "}
                <b className="font-mono text-[var(--color-ink)]">
                  {nowcast.model.replace(/_/g, " ")}
                </b>
              </span>
              {nowcast.skill_tss != null && (
                <span>
                  Test TSS:{" "}
                  <b className="font-mono text-[var(--color-ink)]">
                    {nowcast.skill_tss.toFixed(2)}
                  </b>
                </span>
              )}
              <span>
                Source:{" "}
                <b
                  className={clsx(
                    "font-mono",
                    nowcast.source === "trained-model"
                      ? "text-[var(--color-risk-low)]"
                      : "text-[var(--color-ink)]",
                  )}
                >
                  {nowcast.source}
                </b>
              </span>
            </div>
            <p className="text-xs leading-relaxed text-[var(--color-ink-faint)]">
              {nowcast.note}
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-ink-muted)]">Loading nowcast…</p>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title={`Flare class probability — ${horizon}h`}
          subtitle="Probability of at least the given class within the horizon"
          action={active && <RiskBadge risk={active.severity} />}
        >
          {active ? (
            <div className="space-y-5">
              <ProbBar label="C" value={active.probabilities.C} color="var(--color-risk-low)" />
              <ProbBar label="M" value={active.probabilities.M} color="var(--color-risk-high)" />
              <ProbBar label="X" value={active.probabilities.X} color="var(--color-risk-severe)" />
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--color-panel-border)] pt-4 text-sm">
                <span className="text-[var(--color-ink-muted)]">
                  Most likely:{" "}
                  <b className="font-mono text-[var(--color-ink)]">{active.most_likely_class}-class</b>
                </span>
                <span className="text-[var(--color-ink-muted)]">
                  Severity: <b className="text-[var(--color-ink)]">{active.severity}</b>
                </span>
                <span className="text-[var(--color-ink-muted)]">
                  Confidence:{" "}
                  <b className="font-mono text-[var(--color-ink)]">
                    {Math.round(active.confidence * 100)}%
                  </b>
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-ink-muted)]">Loading forecast…</p>
          )}
        </Panel>

        <Panel title="Solar parameter risk radar" subtitle="Normalised drivers">
          <div className="grid place-items-center py-2">
            <Radar axes={radarAxes} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Explainable AI — why this prediction?" subtitle="SHAP-style feature importance">
          {active && (
            <ul className="space-y-3">
              {active.drivers.map((d) => (
                <li key={d.feature} className="flex items-center gap-3">
                  <span className="w-48 shrink-0 text-sm text-[var(--color-ink-muted)]">
                    {d.feature}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-space-700)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-solar-400)]"
                      style={{ width: `${Math.round(d.importance * 100)}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-xs text-[var(--color-ink-muted)]">
                    {Math.round(d.importance * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Root-cause analysis" subtitle="Primary trigger">
          {active && (
            <div className="space-y-3">
              <p className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-space-900)]/50 p-4 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                {active.rationale}
              </p>
              <div className="flex items-center justify-between rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-space-900)]/50 px-4 py-3 text-sm">
                <span className="text-[var(--color-ink-muted)]">Dominant driver</span>
                <span className="font-semibold text-[var(--color-solar-300)]">
                  {active.drivers[0]?.feature}
                </span>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
