"use client";

import { useLiveSolar } from "@/lib/hooks";
import { MetricCard } from "@/components/ui/primitives";
import Reveal from "./Reveal";

export default function LiveStrip() {
  const { data, live } = useLiveSolar();

  const items = [
    { label: "Kp Index", value: data.kp_index, hint: data.kp_label },
    { label: "Solar Wind", value: data.solar_wind_speed, unit: "km/s", hint: "ACE / DSCOVR" },
    { label: "Bz (IMF)", value: data.bz.toFixed(1), unit: "nT", hint: data.bz < 0 ? "Southward" : "Northward" },
    { label: "X-ray Flux", value: data.xray_class, hint: "GOES" },
    { label: "Sunspots", value: data.sunspot_number, hint: "SILSO R" },
    { label: "Proton Density", value: data.proton_density.toFixed(1), unit: "p/cm³", hint: "Plasma" },
  ];

  return (
    <section className="relative z-10 mx-auto -mt-10 max-w-7xl px-5 sm:px-8">
      <Reveal>
        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="text-[11px] uppercase tracking-widest text-[var(--color-ink-faint)]">
              Live heliophysics feed
            </span>
            <span className="font-mono text-[11px] text-[var(--color-ink-muted)]">
              {live ? "● streaming" : "○ demo data"} ·{" "}
              {new Date(data.timestamp).toUTCString().slice(17, 25)} UTC
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {items.map((it) => (
              <MetricCard key={it.label} {...it} />
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
