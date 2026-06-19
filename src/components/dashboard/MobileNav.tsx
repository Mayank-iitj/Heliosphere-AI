"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const ITEMS = [
  { href: "/dashboard", label: "Control", icon: "🛰️" },
  { href: "/dashboard/predict", label: "Predict", icon: "📈" },
  { href: "/dashboard/twin", label: "Twin", icon: "🌐" },
  { href: "/dashboard/copilot", label: "Copilot", icon: "🤖" },
  { href: "/dashboard/alerts", label: "Alerts", icon: "🚨" },
];

export default function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-30 flex border-t border-[var(--color-panel-border)] bg-[var(--color-space-900)]/95 backdrop-blur lg:hidden">
      {ITEMS.map((it) => {
        const active = pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={clsx(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
              active ? "text-[var(--color-solar-300)]" : "text-[var(--color-ink-muted)]",
            )}
          >
            <span className="text-base">{it.icon}</span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
