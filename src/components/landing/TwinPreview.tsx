"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HeroCanvas from "@/components/three/HeroCanvas";
import { api, type ActiveRegion } from "@/lib/api";
import { RiskBadge } from "@/components/ui/primitives";
import { useLiveSolar } from "@/lib/hooks";
import Reveal from "./Reveal";

const DEMO_REGIONS: ActiveRegion[] = [
  { id: "ar1", noaa_number: 3842, classification: "βγδ", area: 720, risk: "High", lat: 12, lon: -34 },
  { id: "ar2", noaa_number: 3847, classification: "βγ", area: 410, risk: "Moderate", lat: -8, lon: 21 },
  { id: "ar3", noaa_number: 3848, classification: "β", area: 160, risk: "Low", lat: 23, lon: 58 },
];

export default function TwinPreview() {
  const { data } = useLiveSolar();
  const [regions, setRegions] = useState<ActiveRegion[]>(DEMO_REGIONS);

  useEffect(() => {
    api
      .activeRegions()
      .then((r) => r.length && setRegions(r))
      .catch(() => {});
  }, []);

  return (
    <section id="twin" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <Reveal className="order-2 lg:order-1">
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-[var(--color-panel-border)] bg-[var(--color-space-950)]">
            <HeroCanvas activity={data.activity} />
            <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-black/40 px-3 py-1.5 text-[11px] backdrop-blur">
              <span className="text-[var(--color-ink-faint)]">HelioTwin</span> ·{" "}
              <span className="font-mono text-[var(--color-solar-300)]">
                live render
              </span>
            </div>
            <div className="pointer-events-none absolute bottom-4 right-4 rounded-lg bg-black/40 px-3 py-1.5 font-mono text-[11px] text-[var(--color-ink-muted)] backdrop-blur">
              activity {Math.round(data.activity * 100)}%
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="order-1 lg:order-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-solar-400)]">
            HelioTwin 3D
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-5xl">
            A living <span className="solar-gradient-text">digital twin</span> of the Sun.
          </h2>
          <p className="mt-4 max-w-lg text-[var(--color-ink-muted)]">
            Procedurally rendered granulation, limb darkening and corona — no
            multi-megabyte textures, so it stays sharp and smooth even on
            integrated graphics. Active regions are mapped from live data.
          </p>

          <div className="mt-6 space-y-2">
            {regions.slice(0, 4).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-space-900)]/50 px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-[var(--color-ink)]">
                    AR{r.noaa_number}
                  </span>
                  <span className="text-xs text-[var(--color-ink-muted)]">
                    {r.classification} · {r.area} MH
                  </span>
                </div>
                <RiskBadge risk={r.risk} />
              </div>
            ))}
          </div>

          <Link
            href="/dashboard/twin"
            className="mt-6 inline-flex rounded-full border border-[var(--color-panel-border)] px-5 py-2.5 text-sm font-semibold transition-colors hover:border-[var(--color-solar-400)]"
          >
            Open the interactive twin →
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
