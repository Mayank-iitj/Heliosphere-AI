"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import HeroCanvas from "@/components/three/HeroCanvas";
import { StatusPill } from "@/components/ui/primitives";
import { useLiveSolar } from "@/lib/hooks";

export default function Hero() {
  const { data, live } = useLiveSolar();

  return (
    <section className="relative min-h-[100svh] overflow-hidden">
      {/* 3D layer */}
      <div className="absolute inset-0">
        <HeroCanvas activity={data.activity} />
      </div>

      {/* readability gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[var(--color-space-950)]/70 via-transparent to-[var(--color-space-950)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[var(--color-space-950)]/85 via-[var(--color-space-950)]/20 to-transparent" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-5 pt-28 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <StatusPill status={data.status} live={live} />
            <span className="font-mono text-xs text-[var(--color-ink-muted)]">
              Kp {data.kp_index} · {data.xray_class} · {data.solar_wind_speed} km/s
            </span>
          </div>

          <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            See the Sun
            <br />
            <span className="solar-gradient-text">before it acts.</span>
          </h1>

          <p className="mt-6 max-w-xl text-balance text-lg text-[var(--color-ink-muted)]">
            HelioSphere AI fuses live heliophysics feeds, machine-learning flare
            forecasting and an interactive 3D digital twin of the Sun — so
            operators can anticipate space weather, not just react to it.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-full bg-[var(--color-solar-500)] px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.03] hover:bg-[var(--color-solar-400)]"
            >
              Launch Mission Control →
            </Link>
            <a
              href="#twin"
              className="rounded-full border border-[var(--color-panel-border)] px-6 py-3 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-solar-400)]"
            >
              Explore the digital twin
            </a>
          </div>

          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6">
            {[
              { k: "< 60s", v: "Ingestion latency" },
              { k: "6 h", v: "Flare lead time" },
              { k: "24/7", v: "Autonomous watch" },
            ].map((s) => (
              <div key={s.v}>
                <dt className="font-mono text-2xl font-semibold text-[var(--color-solar-300)]">
                  {s.k}
                </dt>
                <dd className="mt-1 text-xs text-[var(--color-ink-muted)]">{s.v}</dd>
              </div>
            ))}
          </dl>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-[var(--color-ink-faint)]">
        scroll to explore
      </div>
    </section>
  );
}
