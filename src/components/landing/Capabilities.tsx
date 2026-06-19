"use client";

import Reveal from "./Reveal";

const CAPS = [
  {
    tag: "HelioPredict",
    title: "ML flare forecasting",
    body: "Ensemble + temporal models estimate C/M/X-class flare probability up to 24h ahead, with SHAP explanations and root-cause attribution.",
    icon: "📈",
  },
  {
    tag: "HelioTwin 3D",
    title: "Interactive solar digital twin",
    body: "A real-time 3D Sun you can rotate and inspect — active regions, sunspot groups and flare hotspots rendered from live data.",
    icon: "🌐",
  },
  {
    tag: "Satellite Risk",
    title: "Asset impact scoring",
    body: "Translate geomagnetic conditions into operational risk for satellites, GNSS and HF comms — before the storm front arrives.",
    icon: "🛰️",
  },
  {
    tag: "HelioGPT",
    title: "Grounded copilot",
    body: "Ask anything about current conditions. Answers are grounded on the live feed and forecast state — with citations, not hallucinations.",
    icon: "🤖",
  },
  {
    tag: "Comms Blackout",
    title: "HF & GNSS degradation",
    body: "D-region absorption and radio-blackout nowcasts mapped to the regions and frequencies that matter to your operation.",
    icon: "📡",
  },
  {
    tag: "Alert Center",
    title: "Autonomous watch",
    body: "A scheduler ingests feeds every minute and raises tiered alerts — info, watch, warning, severe — with acknowledgement workflow.",
    icon: "🚨",
  },
];

export default function Capabilities() {
  return (
    <section id="capabilities" className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
      <Reveal>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-solar-400)]">
          Capabilities
        </p>
        <h2 className="mt-3 max-w-2xl text-balance text-3xl font-bold tracking-tight sm:text-5xl">
          One console for the whole{" "}
          <span className="solar-gradient-text">space-weather chain</span>.
        </h2>
        <p className="mt-4 max-w-xl text-[var(--color-ink-muted)]">
          From raw heliophysics telemetry to operator-ready decisions — ingestion,
          forecasting, visualization and alerting in a single pipeline.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CAPS.map((c, i) => (
          <Reveal key={c.tag} delay={(i % 3) * 0.06}>
            <article className="group glass h-full rounded-2xl p-6 transition-colors hover:border-[var(--color-solar-500)]/60">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{c.icon}</span>
                <span className="rounded-full border border-[var(--color-panel-border)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-solar-300)]">
                  {c.tag}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                {c.body}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
