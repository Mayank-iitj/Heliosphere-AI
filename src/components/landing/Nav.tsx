"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "#capabilities", label: "Capabilities" },
  { href: "#forecast", label: "Forecasting" },
  { href: "#twin", label: "Digital Twin" },
  { href: "#how", label: "How it works" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "py-2" : "py-4"
      }`}
    >
      <div
        className={`mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full px-4 py-2.5 transition-all duration-300 sm:px-6 ${
          scrolled ? "glass mx-3 shadow-2xl" : "bg-transparent"
        }`}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <SunMark />
          <span className="text-sm font-semibold tracking-tight">
            HelioSphere<span className="text-[var(--color-solar-400)]"> AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-[var(--color-panel-border)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-solar-300)] sm:inline">
            ISRO Ready
          </span>
          <Link
            href="/dashboard"
            className="rounded-full bg-[var(--color-solar-500)] px-4 py-2 text-sm font-semibold text-black transition-transform hover:scale-[1.03] hover:bg-[var(--color-solar-400)]"
          >
            Open Console
          </Link>
        </div>
      </div>
    </header>
  );
}

function SunMark() {
  return (
    <span
      className="grid h-7 w-7 place-items-center rounded-full"
      style={{
        background:
          "radial-gradient(circle at 35% 30%, #ffe39a, #ff8a00 55%, #ff5e3a)",
        boxShadow: "0 0 14px 2px rgba(255,138,0,0.5)",
      }}
    >
      <span className="h-2 w-2 rounded-full bg-black/30" />
    </span>
  );
}
