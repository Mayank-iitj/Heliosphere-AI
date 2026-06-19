"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useLiveSolar } from "@/lib/hooks";

const SECTIONS: { heading: string; items: { href: string; label: string; icon: string }[] }[] = [
  {
    heading: "Overview",
    items: [
      { href: "/dashboard", label: "Mission Control", icon: "🛰️" },
      { href: "/dashboard/alerts", label: "Alert Center", icon: "🚨" },
    ],
  },
  {
    heading: "Intelligence",
    items: [
      { href: "/dashboard/predict", label: "HelioPredict", icon: "📈" },
      { href: "/dashboard/twin", label: "HelioTwin 3D", icon: "🌐" },
      { href: "/dashboard/copilot", label: "HelioGPT Copilot", icon: "🤖" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data } = useLiveSolar();
  const kpPct = Math.min(100, (data.kp_index / 9) * 100);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--color-panel-border)] bg-[var(--color-space-900)]/60 p-4 lg:flex">
      <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
        <span
          className="grid h-7 w-7 place-items-center rounded-full"
          style={{
            background: "radial-gradient(circle at 35% 30%, #ffe39a, #ff8a00 55%, #ff5e3a)",
            boxShadow: "0 0 14px 2px rgba(255,138,0,0.5)",
          }}
        />
        <span className="text-sm font-semibold tracking-tight">
          HelioSphere<span className="text-[var(--color-solar-400)]"> AI</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-6">
        {SECTIONS.map((sec) => (
          <div key={sec.heading}>
            <div className="px-2 pb-2 text-[10px] uppercase tracking-widest text-[var(--color-ink-faint)]">
              {sec.heading}
            </div>
            <ul className="space-y-1">
              {sec.items.map((it) => {
                const active = pathname === it.href;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={clsx(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-[var(--color-solar-500)]/15 font-medium text-[var(--color-solar-300)]"
                          : "text-[var(--color-ink-muted)] hover:bg-[var(--color-space-800)] hover:text-[var(--color-ink)]",
                      )}
                    >
                      <span className="text-base">{it.icon}</span>
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Kp gauge */}
      <div className="mt-4 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-space-800)]/50 p-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[var(--color-ink-faint)]">
          <span>Kp Index</span>
          <span>{data.kp_label}</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-[var(--color-solar-300)]">
            {data.kp_index.toFixed(1)}
          </span>
          <span className="text-xs text-[var(--color-ink-faint)]">/ 9</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-space-700)]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${kpPct}%`,
              background:
                "linear-gradient(90deg, var(--color-risk-low), var(--color-risk-moderate), var(--color-risk-severe))",
            }}
          />
        </div>
      </div>
    </aside>
  );
}
