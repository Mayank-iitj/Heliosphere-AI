"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { useQuality } from "@/lib/quality";

/**
 * Lenis-powered smooth scroll. On low-end / reduced-motion devices we skip the
 * RAF-driven interpolation entirely and let the browser scroll natively — that
 * is the single biggest win for jank-free scrolling on weak hardware.
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const resolve = useQuality((s) => s.resolve);

  useEffect(() => {
    resolve();
    const { tier, reducedMotion } = useQuality.getState();

    if (reducedMotion || tier === "low") return;

    const lenis = new Lenis({
      duration: tier === "high" ? 1.1 : 0.9,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      lerp: 0.1,
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [resolve]);

  return <>{children}</>;
}
