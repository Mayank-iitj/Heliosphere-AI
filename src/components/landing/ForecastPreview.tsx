"use client";

import { useEffect, useState } from "react";
import { api, type ForecastHorizon } from "@/lib/api";
import { ProbBar, RiskBadge } from "@/components/ui/primitives";
import Reveal from "./Reveal";

const DEMO: ForecastHorizon = {
  horizon_hours: 6,
  probabilities: { C: 0.66, M: 0.45, X: 0.12 },
  most_likely_class: "C",
  severity: "Moderate",
  confidence: 0.78,
  drivers: [
    { feature: "Magnetic flux complexity", importance: 0.31, direction: "up" },
    { feature: "Active region area", importance: 0.24, direction: "up" },
    { feature: "βγδ Hale class", importance: 0.19, direction: "up" },
    { feature: "Prior 24h flare rate", importance: 0.16, direction: "up" },
  ],
  rationale:
    "Region AR3848 shows a βγδ configuration with rapid flux emergence, elevating M-class probability over the next 6 hours.",
};

export default function ForecastPreview() {
  const [f, setF] = useState<ForecastHorizon>(DEMO);
  const [live, setLive] = useState(false);

  useEffect(() => {
    api
      .forecast()
      .then((list) => {
        const six = list.find((h) => h.horizon_hours === 6) ?? list[0];
        if (six) {
          setF(six);
          setLive(true);
        }
      })
      .catch(() => setLive(false));
  }, []);

  return (
    <section id="forecast" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-solar-400)]">
            HelioPredict
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-5xl">
            Flare forecasting you can{" "}
            <span className="solar-gradient-text">defend in a briefing</span>.
          </h2>
          <p className="mt-4 max-w-lg text-[var(--color-ink-muted)]">
            Every prediction ships with its drivers. SHAP-style feature attribution
            and a plain-language rationale mean operators understand <em>why</em> a
            forecast moved — not just the number.
          </p>
          <ul className="mt-6 space-y-3">
            {f.drivers.slice(0, 4).map((d) => (
              <li key={d.feature} className="flex items-center gap-3 text-sm">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-space-700)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-solar-400)]"
                    style={{ width: `${Math.round(d.importance * 100)}%` }}
                  />
                </div>
                <span className="w-44 text-[var(--color-ink-muted)]">{d.feature}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Flare class probability</h3>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  {f.horizon_hours}h horizon · {live ? "live model" : "sample"}
                </p>
              </div>
              <RiskBadge risk={f.severity} />
            </div>
            <div className="mt-6 space-y-4">
              <ProbBar label="C" value={f.probabilities.C} color="var(--color-risk-low)" />
              <ProbBar label="M" value={f.probabilities.M} color="var(--color-risk-high)" />
              <ProbBar label="X" value={f.probabilities.X} color="var(--color-risk-severe)" />
            </div>
            <div className="mt-6 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-space-900)]/60 p-4">
              <div className="text-[11px] uppercase tracking-widest text-[var(--color-ink-faint)]">
                Root-cause rationale
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                {f.rationale}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-ink-muted)]">
              <span>
                Most likely:{" "}
                <span className="font-mono font-semibold text-[var(--color-ink)]">
                  {f.most_likely_class}-class
                </span>
              </span>
              <span>
                Confidence:{" "}
                <span className="font-mono font-semibold text-[var(--color-ink)]">
                  {Math.round(f.confidence * 100)}%
                </span>
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
