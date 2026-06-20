"use client";

import { useRef, useEffect, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Float, Environment } from "@react-three/drei";
import * as THREE from "three";
import dynamic from "next/dynamic";
import Reveal from "./Reveal";

const AdityaL1Model = dynamic(
  () => import("@/components/three/AdityaL1"),
  { ssr: false }
);

/**
 * Aditya L1 spacecraft section for the landing page.
 * Shows an interactive 3D model that responds to scroll.
 */
export default function AdityaL1Section() {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      // Calculate progress as the section comes into view
      const progress = 1 - rect.top / (windowHeight + rect.height);
      setScrollProgress(Math.max(0, Math.min(1, progress)));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      ref={sectionRef}
      id="aditya-l1"
      className="relative mx-auto max-w-7xl px-5 py-28 sm:px-8"
    >
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-solar-400)]">
            Mission Partner
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-5xl">
            Built for <span className="solar-gradient-text">Aditya-L1</span> operations.
          </h2>
          <p className="mt-4 max-w-lg text-[var(--color-ink-muted)]">
            HelioSphere AI is designed to integrate with India&apos;s first solar
            mission. Process real-time data from the Solar Oriented Platform (SOP)
            and visualize observations from all 7 scientific payloads.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              { label: "Lagrange Point", value: "L1" },
              { label: "Distance", value: "1.5M km" },
              { label: "Orbit Period", value: "~177 days" },
              { label: "Payloads", value: "7 units" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-space-900)]/50 p-4"
              >
                <div className="text-xs text-[var(--color-ink-muted)]">
                  {item.label}
                </div>
                <div className="mt-1 font-mono text-lg font-semibold text-[var(--color-solar-300)]">
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-sm text-[var(--color-ink-muted)]">
            <span className="text-[var(--color-ink-faint)]">Key Payloads:</span>{" "}
            VELC, SUIT, ASPEX, PXL, STIX, SoLEXS, HELIOS
          </div>
        </Reveal>

        <Reveal delay={0.1} className="order-first lg:order-last">
          <div className="relative h-[400px] w-full overflow-hidden rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-space-950)]">
            <div className="absolute left-4 top-4 z-10 rounded-lg bg-black/40 px-3 py-1.5 backdrop-blur">
              <span className="text-[11px] text-[var(--color-ink-faint)]">Aditya-L1</span>
              <span className="ml-2 font-mono text-[11px] text-[var(--color-solar-300)]">
                Interactive Model
              </span>
            </div>

            <Canvas
              gl={{
                antialias: true,
                alpha: true,
                powerPreference: "high-performance",
              }}
              style={{ background: "transparent", cursor: "grab" }}
            >
              <Suspense fallback={null}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 5, 5]} intensity={1} />
                <directionalLight
                  position={[-3, 2, -5]}
                  intensity={0.4}
                  color="#87ceeb"
                />
                <pointLight position={[2, 1, 2]} intensity={0.3} color="#ffd700" />

                <AdityaL1Model scale={0.7} />

                <OrbitControls
                  enableZoom={true}
                  enablePan={false}
                  minDistance={2}
                  maxDistance={6}
                  autoRotate
                  autoRotateSpeed={0.5}
                />

                <Environment preset="night" />
              </Suspense>
            </Canvas>

            <div className="pointer-events-none absolute bottom-4 right-4 rounded-lg bg-black/40 px-3 py-1.5 backdrop-blur">
              <span className="font-mono text-[10px] text-[var(--color-ink-faint)]">
                Drag to rotate · Scroll to zoom
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}