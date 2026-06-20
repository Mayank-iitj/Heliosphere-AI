"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";

/* ─── Payload Data ────────────────────────────────────────────────────── */
const PAYLOADS = [
  {
    id: "velc",
    name: "VELC",
    full: "Visible Emission Line Coronagraph",
    type: "Remote Sensing",
    role: "Continuously images the solar corona and measures velocity / magnetic-field fluctuations inside the corona.",
    specs: ["5000 frames/day", "460–530 nm", "1–6 R☉"],
    color: "#ff8a00",
    dot: { x: 56, y: 28 },   // % position on the visual overlay grid
    side: "right" as const,
  },
  {
    id: "suit",
    name: "SUIT",
    full: "Solar Ultra-violet Imaging Telescope",
    type: "Remote Sensing",
    role: "Images the photosphere and chromosphere in near UV (200–400 nm) using 11 science filters.",
    specs: ["11 filters", "200–400 nm", "Full-disk"],
    color: "#b57aff",
    dot: { x: 40, y: 22 },
    side: "left" as const,
  },
  {
    id: "aspex",
    name: "ASPEX",
    full: "Aditya Solar Wind Particle EXperiment",
    type: "In-Situ",
    role: "Studies solar wind protons and alpha particles to understand energetic particle dynamics near L1.",
    specs: ["100 eV–20 keV", "In-situ", "Omni-directional"],
    color: "#3ddc97",
    dot: { x: 72, y: 55 },
    side: "right" as const,
  },
  {
    id: "papa",
    name: "PAPA",
    full: "Plasma Analyser Package for Aditya",
    type: "In-Situ",
    role: "Measures solar wind electrons and heavy ions, providing composition and energy distribution data.",
    specs: ["10 eV–25 keV", "Electrons + ions", "L1 point"],
    color: "#00c2ff",
    dot: { x: 28, y: 58 },
    side: "left" as const,
  },
  {
    id: "sol",
    name: "SoLEXS",
    full: "Solar Low Energy X-ray Spectrometer",
    type: "Remote Sensing",
    role: "Monitors soft X-ray emission from the Sun as a star, detecting micro-flares and pre-flare activity.",
    specs: ["1–15 keV", "Full-disk", "Soft X-ray"],
    color: "#ff4d4d",
    dot: { x: 62, y: 68 },
    side: "right" as const,
  },
  {
    id: "hel1os",
    name: "HEL1OS",
    full: "High Energy L1 Orbiting X-ray Spectrometer",
    type: "Remote Sensing",
    role: "Studies hard X-ray emission during solar flares to understand particle acceleration in the corona.",
    specs: ["10–150 keV", "Hard X-ray", "Flare spectra"],
    color: "#ff6b35",
    dot: { x: 35, y: 75 },
    side: "left" as const,
  },
  {
    id: "mag",
    name: "MAG",
    full: "Magnetometer",
    type: "In-Situ",
    role: "Measures inter-planetary magnetic field (IMF) strength and direction at the L1 point with high precision.",
    specs: ["±65,536 nT", "4 samples/s", "Dual fluxgate"],
    color: "#ffd166",
    dot: { x: 50, y: 85 },
    side: "right" as const,
  },
];

/* ─── Annotation Pin ─────────────────────────────────────────────────── */
function Pin({
  payload,
  active,
  onClick,
}: {
  payload: (typeof PAYLOADS)[0];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ left: `${payload.dot.x}%`, top: `${payload.dot.y}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group"
      aria-label={`Show ${payload.name} annotation`}
    >
      {/* Pulse ring */}
      <span
        className="absolute inset-0 rounded-full animate-ping opacity-60"
        style={{ background: payload.color }}
      />
      {/* Core dot */}
      <span
        className="relative flex h-4 w-4 rounded-full border-2 border-white/30 transition-transform duration-300 group-hover:scale-125"
        style={{
          background: active ? payload.color : `${payload.color}66`,
          boxShadow: active ? `0 0 12px 4px ${payload.color}88` : "none",
        }}
      />
    </button>
  );
}

/* ─── Annotation Card ────────────────────────────────────────────────── */
function AnnotationCard({ payload }: { payload: (typeof PAYLOADS)[0] }) {
  return (
    <motion.div
      key={payload.id}
      initial={{ opacity: 0, x: payload.side === "right" ? 40 : -40, y: 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: payload.side === "right" ? 40 : -40 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="pointer-events-none select-none"
    >
      <div
        className="rounded-2xl border p-5 backdrop-blur-xl"
        style={{
          background: `linear-gradient(135deg, ${payload.color}14 0%, rgba(7,11,22,0.92) 60%)`,
          borderColor: `${payload.color}40`,
          boxShadow: `0 0 40px ${payload.color}22, inset 0 1px 0 ${payload.color}20`,
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
            style={{ background: `${payload.color}22`, color: payload.color }}
          >
            {payload.id.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base">{payload.name}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ background: `${payload.color}22`, color: payload.color }}
              >
                {payload.type}
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-ink-faint)] mt-0.5">{payload.full}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-[var(--color-ink-muted)] leading-relaxed mb-4">
          {payload.role}
        </p>

        {/* Specs */}
        <div className="flex flex-wrap gap-2">
          {payload.specs.map((s) => (
            <span
              key={s}
              className="rounded-md px-2 py-1 font-mono text-[11px]"
              style={{ background: `${payload.color}14`, color: `${payload.color}cc` }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Progress Stepper ───────────────────────────────────────────────── */
function Stepper({
  current,
  total,
  onSelect,
}: {
  current: number;
  total: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className="transition-all duration-300"
          aria-label={`Go to payload ${i + 1}`}
        >
          <div
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i === current ? "2rem" : "0.375rem",
              background:
                i === current
                  ? PAYLOADS[i].color
                  : i < current
                  ? PAYLOADS[i].color + "66"
                  : "#1d2b45",
            }}
          />
        </button>
      ))}
    </div>
  );
}

/* ─── Main Section ───────────────────────────────────────────────────── */
export default function AdityaL1Section() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [manualIdx, setManualIdx] = useState<number | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const SKETCHFAB_ID = "6658e75eb32240d6a485227564ad2938";

  /* Scroll-drive: section occupies ~7 screens → each screen = 1 payload */
  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const totalScroll = sectionRef.current.offsetHeight - window.innerHeight;
      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / totalScroll));
      setScrollProgress(progress);

      if (manualIdx === null) {
        const idx = Math.min(
          PAYLOADS.length - 1,
          Math.floor(progress * PAYLOADS.length)
        );
        setActiveIdx(idx);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [manualIdx]);

  /* Clear manual override after 3s */
  useEffect(() => {
    if (manualIdx === null) return;
    const t = setTimeout(() => setManualIdx(null), 3000);
    return () => clearTimeout(t);
  }, [manualIdx]);

  const handlePinClick = useCallback((i: number) => {
    setManualIdx(i);
    setActiveIdx(i);
  }, []);

  const handleStepperSelect = useCallback((i: number) => {
    setManualIdx(i);
    setActiveIdx(i);
  }, []);

  const payload = PAYLOADS[activeIdx];

  return (
    <section
      ref={sectionRef}
      id="aditya-l1"
      /* 7 viewports tall → scroll-pin effect */
      style={{ height: `${PAYLOADS.length * 100}vh` }}
      className="relative"
    >
      {/* ── Sticky viewport ── */}
      <div className="sticky top-0 h-screen w-full overflow-hidden flex flex-col">
        {/* Background glow */}
        <div
          className="pointer-events-none absolute inset-0 z-0 transition-all duration-700"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 50% 40%, ${payload.color}12, transparent 70%)`,
          }}
        />

        {/* Header */}
        <div className="relative z-10 flex flex-col items-center pt-8 pb-4 px-4">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-solar-400)]">
            Mission Payloads
          </span>
          <h2 className="mt-2 text-2xl sm:text-4xl font-bold tracking-tight text-center">
            <span className="solar-gradient-text">Aditya-L1</span>{" "}
            <span className="text-[var(--color-ink)]">Spacecraft</span>
          </h2>
          <p className="mt-1.5 max-w-lg text-center text-sm text-[var(--color-ink-muted)]">
            India&apos;s first solar observatory at Lagrange point L1 — scroll to explore all 7 scientific payloads.
          </p>

          {/* Stepper */}
          <div className="mt-3 flex flex-col items-center gap-1">
            <Stepper
              current={activeIdx}
              total={PAYLOADS.length}
              onSelect={handleStepperSelect}
            />
            <span className="text-[10px] text-[var(--color-ink-faint)] font-mono mt-1">
              {activeIdx + 1} / {PAYLOADS.length} &mdash; {payload.name}
            </span>
          </div>
        </div>

        {/* Main content: FULL-WIDTH iframe with floating overlay cards */}
        <div className="relative z-10 flex flex-1 min-h-0 px-4 pb-2">
          {/* Iframe container — full width */}
          <div
            className="relative w-full rounded-2xl overflow-hidden border"
            style={{ borderColor: `${payload.color}30` }}
          >
            {/* Animated glow border */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none z-10 transition-all duration-500"
              style={{ boxShadow: `inset 0 0 50px ${payload.color}18, 0 0 80px ${payload.color}12` }}
            />

            {/* The actual Sketchfab embed — fills 100% */}
            <iframe
              title="Aditya-L1 3D Model"
              className="w-full h-full block"
              src={`https://sketchfab.com/models/${SKETCHFAB_ID}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_controls=1&ui_stop=0&transparent=1&dnt=1`}
              allow="autoplay; fullscreen; xr-spatial-tracking"
              allowFullScreen
              style={{ border: 0, background: "transparent", minHeight: 0 }}
            />

            {/* Pin overlay */}
            <div className="absolute inset-0 z-20 pointer-events-none">
              {PAYLOADS.map((p, i) => (
                <div key={p.id} className="pointer-events-auto">
                  <Pin
                    payload={p}
                    active={activeIdx === i}
                    onClick={() => handlePinClick(i)}
                  />
                </div>
              ))}
            </div>

            {/* ── Floating annotation card — LEFT side ── */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-72 xl:w-80 pointer-events-none">
              <AnimatePresence mode="wait">
                {payload.side === "left" && (
                  <AnnotationCard key={payload.id} payload={payload} />
                )}
              </AnimatePresence>
            </div>

            {/* ── Floating annotation card — RIGHT side ── */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-72 xl:w-80 pointer-events-none">
              <AnimatePresence mode="wait">
                {payload.side === "right" && (
                  <AnnotationCard key={payload.id} payload={payload} />
                )}
              </AnimatePresence>
            </div>

            {/* ── Mobile: bottom-center card ── */}
            <div className="lg:hidden absolute bottom-20 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] pointer-events-none">
              <AnimatePresence mode="wait">
                <AnnotationCard key={payload.id} payload={payload} />
              </AnimatePresence>
            </div>

            {/* Corner badge */}
            <div className="absolute top-3 left-3 z-30 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur border border-white/10">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[11px] font-mono text-[var(--color-ink-faint)]">
                ISRO · Aditya-L1 · Interactive 3D
              </span>
            </div>

            {/* Drag hint */}
            <div className="absolute bottom-3 right-3 z-30 rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur border border-white/10">
              <span className="text-[10px] font-mono text-[var(--color-ink-faint)]">
                Drag · Pinch · Scroll to explore payloads
              </span>
            </div>
          </div>
        </div>

        {/* Scroll progress bar */}
        <div className="relative z-10 px-4 pb-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--color-panel-border)] relative overflow-hidden rounded-full">
              <motion.div
                className="absolute left-0 top-0 h-full rounded-full"
                style={{
                  width: `${scrollProgress * 100}%`,
                  background: `linear-gradient(90deg, ${PAYLOADS[0].color}, ${payload.color})`,
                }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <span className="text-[10px] font-mono text-[var(--color-ink-faint)] shrink-0">
              {Math.round(scrollProgress * 100)}%
            </span>
          </div>
          {/* Payload name list */}
          <div className="flex flex-wrap gap-2 mt-2">
            {PAYLOADS.map((p, i) => (
              <button
                key={p.id}
                onClick={() => handleStepperSelect(i)}
                className="rounded-full px-3 py-1 text-[11px] font-mono transition-all duration-200"
                style={{
                  background: activeIdx === i ? `${p.color}22` : "transparent",
                  color: activeIdx === i ? p.color : "var(--color-ink-faint)",
                  border: `1px solid ${activeIdx === i ? p.color + "50" : "var(--color-panel-border)"}`,
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Scroll indicator arrow (only shown when not fully scrolled) */}
        {scrollProgress < 0.95 && (
          <motion.div
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1"
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          >
            <span className="text-[10px] text-[var(--color-ink-faint)] uppercase tracking-widest">scroll</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M4 9l4 4 4-4" stroke="var(--color-ink-faint)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.div>
        )}
      </div>
    </section>
  );
}