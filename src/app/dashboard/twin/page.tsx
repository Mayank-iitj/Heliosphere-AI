"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { api, type ActiveRegion } from "@/lib/api";
import { useLiveSolar } from "@/lib/hooks";
import { Panel, RiskBadge } from "@/components/ui/primitives";
import clsx from "clsx";

const TwinScene = dynamic(() => import("@/components/three/TwinScene"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-[var(--color-ink-muted)]">
      Initialising digital twin…
    </div>
  ),
});

export default function TwinPage() {
  const { data } = useLiveSolar(10000);
  const [regions, setRegions] = useState<ActiveRegion[]>([]);
  const [selected, setSelected] = useState<ActiveRegion | null>(null);

  useEffect(() => {
    api.activeRegions().then(setRegions).catch(() => {});
  }, []);

  return (
    <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_320px]">
      <Panel
        className="overflow-hidden p-0"
        // header handled inside for full-bleed canvas
      >
        <div className="relative h-[64vh] min-h-[420px]">
          <TwinScene
            activity={data.activity}
            regions={regions}
            onSelect={setSelected}
            selectedId={selected?.id}
          />
          <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-black/45 px-3 py-2 text-xs backdrop-blur">
            <div className="font-semibold text-[var(--color-ink)]">HelioTwin 3D</div>
            <div className="text-[var(--color-ink-muted)]">
              Drag to rotate · tap a region for detail
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-4 right-4 rounded-lg bg-black/45 px-3 py-2 font-mono text-xs text-[var(--color-ink-muted)] backdrop-blur">
            activity {Math.round(data.activity * 100)}% · {data.xray_class}
          </div>
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel title="Active regions" subtitle={`${regions.length} tracked`}>
          <ul className="space-y-2">
            {regions.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setSelected(selected?.id === r.id ? null : r)}
                  className={clsx(
                    "flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left transition-colors",
                    selected?.id === r.id
                      ? "border-[var(--color-solar-400)] bg-[var(--color-solar-500)]/10"
                      : "border-[var(--color-panel-border)] bg-[var(--color-space-900)]/40 hover:border-[var(--color-solar-400)]/50",
                  )}
                >
                  <div>
                    <div className="font-mono text-sm font-semibold">AR{r.noaa_number}</div>
                    <div className="text-xs text-[var(--color-ink-muted)]">
                      {r.classification} · {r.area} MH
                    </div>
                  </div>
                  <RiskBadge risk={r.risk} />
                </button>
              </li>
            ))}
            {!regions.length && (
              <li className="text-sm text-[var(--color-ink-muted)]">Loading regions…</li>
            )}
          </ul>
        </Panel>

        <Panel title="Conditions">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Status" value={data.status} />
            <Stat label="Kp" value={data.kp_index.toFixed(1)} />
            <Stat label="Wind" value={`${data.solar_wind_speed} km/s`} />
            <Stat label="Bz" value={`${data.bz.toFixed(1)} nT`} />
          </dl>
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-space-900)]/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-[var(--color-ink-faint)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm font-semibold capitalize">{value}</div>
    </div>
  );
}
