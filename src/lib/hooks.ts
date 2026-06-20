"use client";

import { useEffect, useRef, useState } from "react";
import { api, type SolarNow } from "./api";

/**
 * Sensible demo values so the UI is never empty while the API warms up.
 * NOTE: `timestamp` must be a *stable constant*, not `new Date()` — this object
 * is rendered during SSR/prerender and again on the client, and a live clock
 * value would differ between the two and trip a React hydration mismatch (#418).
 * Real timestamps arrive from the API after mount, which is fine.
 */
export const DEMO_SOLAR: SolarNow = {
  timestamp: "2026-01-01T00:00:00.000Z",
  kp_index: 3,
  kp_label: "Unsettled",
  solar_wind_speed: 421,
  proton_density: 4.8,
  bz: -2.1,
  xray_flux: 2.4e-6,
  xray_class: "C2.4",
  sunspot_number: 84,
  flare_probability: { C: 0.62, M: 0.18, X: 0.03 },
  status: "unsettled",
  activity: 0.42,
};

/**
 * Polls /solar/now. Falls back to demo data (with `live: false`) if the backend
 * is unreachable, so the marketing surface degrades gracefully.
 */
export function useLiveSolar(intervalMs = 15000) {
  const [data, setData] = useState<SolarNow>(DEMO_SOLAR);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const now = await api.solarNow();
        if (!active) return;
        setData(now);
        setLive(true);
        setError(null);
      } catch (e) {
        if (!active) return;
        setLive(false);
        setError(e instanceof Error ? e.message : "offline");
      } finally {
        if (active) timer.current = setTimeout(tick, intervalMs);
      }
    };
    tick();
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [intervalMs]);

  return { data, live, error };
}
