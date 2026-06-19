"use client";

import Link from "next/link";
import Reveal from "./Reveal";

const STEPS = [
  {
    n: "01",
    title: "Ingest",
    body: "A background scheduler pulls GOES X-ray, ACE/DSCOVR solar wind and Kp every 60 seconds into a time-series store.",
  },
  {
    n: "02",
    title: "Forecast",
    body: "Feature pipelines feed the flare model; probabilities, severity and driver attributions are recomputed continuously.",
  },
  {
    n: "03",
    title: "Visualize",
    body: "The 3D twin and dashboards reflect the latest state. HelioGPT answers questions grounded on that exact snapshot.",
  },
  {
    n: "04",
    title: "Alert",
    body: "Threshold crossings raise tiered alerts with an acknowledgement workflow, ready for an operations desk.",
  },
];

export default function Closing() {
  return (
    <>
      <section id="how" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-solar-400)]">
            How it works
          </p>
          <h2 className="mt-3 max-w-2xl text-balance text-3xl font-bold tracking-tight sm:text-5xl">
            A closed loop from photons to{" "}
            <span className="solar-gradient-text">operational decisions</span>.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={(i % 4) * 0.05}>
              <div className="glass h-full rounded-2xl p-6">
                <div className="font-mono text-3xl font-bold text-[var(--color-solar-500)]/80">
                  {s.n}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-5 pb-28 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-[var(--color-panel-border)] p-10 text-center sm:p-16">
            <div className="grid-glow absolute inset-0 opacity-60" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-balance text-3xl font-bold tracking-tight sm:text-5xl">
                Step into{" "}
                <span className="solar-gradient-text">Mission Control</span>.
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-[var(--color-ink-muted)]">
                Live feeds, forecasts, the 3D twin and the HelioGPT copilot — all
                wired to the backend and ready to explore.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href="/dashboard"
                  className="rounded-full bg-[var(--color-solar-500)] px-7 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.03] hover:bg-[var(--color-solar-400)]"
                >
                  Open the console
                </Link>
                <a
                  href="https://www.swpc.noaa.gov/"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[var(--color-panel-border)] px-7 py-3 text-sm font-semibold transition-colors hover:border-[var(--color-solar-400)]"
                >
                  Data sources
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-[var(--color-panel-border)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-[var(--color-ink-muted)] sm:flex-row sm:px-8">
          <span>© {new Date().getFullYear()} HelioSphere AI · Space-weather intelligence</span>
          <span className="font-mono text-xs text-[var(--color-ink-faint)]">
            Built for the hackathon · Next.js + FastAPI
          </span>
        </div>
      </footer>
    </>
  );
}
