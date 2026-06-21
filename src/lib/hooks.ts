"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type SolarNow, type SolarHistoryPoint, type SolarStatus } from "./api";

/**
 * Stable demo fallback — timestamp must be a constant (not new Date()) to avoid
 * React hydration mismatches between SSR and client render.
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
  source: "synthetic",
};

/**
 * Polls /solar/now every `intervalMs`. Falls back to demo data when offline.
 */
export function useLiveSolar(intervalMs = 15000) {
  const [data, setData]   = useState<SolarNow>(DEMO_SOLAR);
  const [live, setLive]   = useState(false);
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

/**
 * Fetches solar history and refreshes every `intervalMs` (default 5 min).
 */
export function useSolarHistory(hours = 48, intervalMs = 300_000) {
  const [history, setHistory] = useState<SolarHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    api
      .solarHistory(hours)
      .then((h) => { setHistory(h); setLoading(false); })
      .catch(() => setLoading(false));
  }, [hours]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { history, loading, refresh };
}

/**
 * Polls /solar/status for live pipeline health.
 * Used to show the "NOAA Live / Synthetic" badge in the UI.
 */
export function useLiveIndicator(intervalMs = 30_000) {
  const [status, setStatus] = useState<SolarStatus | null>(null);

  useEffect(() => {
    let active = true;
    const tick = () =>
      api
        .solarStatus()
        .then((s) => { if (active) setStatus(s); })
        .catch(() => {});

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  const isLive = status?.source === "noaa-live";
  const label  = isLive ? "NOAA Live" : status ? "Synthetic" : "Connecting…";
  const color  = isLive ? "#4ade80" : status ? "#facc15" : "#94a3b8";

  return { status, isLive, label, color };
}
