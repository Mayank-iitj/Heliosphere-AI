"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { StatusPill } from "@/components/ui/primitives";
import { useLiveSolar } from "@/lib/hooks";

const TITLES: Record<string, string> = {
  "/dashboard": "Mission Control",
  "/dashboard/alerts": "Alert Center",
  "/dashboard/predict": "HelioPredict — Flare Forecasting",
  "/dashboard/twin": "HelioTwin — Solar Digital Twin",
  "/dashboard/copilot": "HelioGPT Copilot",
};

export default function Topbar() {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "Mission Control";
  const { data, live } = useLiveSolar();
  const [clock, setClock] = useState("--:--:--");

  useEffect(() => {
    const tick = () => {
      const timeStr = new Date().toLocaleTimeString("en-US", {
        timeZone: "Asia/Kolkata",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setClock(`${timeStr} IST (GMT+5:30)`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[var(--color-panel-border)] bg-[var(--color-space-950)]/80 px-5 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="rounded-md border border-[var(--color-panel-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-solar-300)]">
          ISRO Ready
        </span>
        <h1 className="text-sm font-semibold tracking-wide sm:text-base">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <span className="hidden font-mono text-xs text-[var(--color-ink-muted)] sm:inline">
          {clock}
        </span>
        <StatusPill status={data.status} live={live} />
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-space-700)] text-xs font-semibold">
            IA
          </span>
          <span className="hidden text-xs text-[var(--color-ink-muted)] sm:inline">
            ISRO Analyst
          </span>
        </div>
      </div>
    </header>
  );
}
