"use client";

import { create } from "zustand";

export type QualityTier = "low" | "medium" | "high";

export interface QualityState {
  tier: QualityTier;
  /** Clamp for the renderer device-pixel-ratio. */
  dpr: [number, number];
  /** Segment counts feed geometry detail. */
  sunSegments: number;
  /** Whether to render the expensive corona / atmosphere passes. */
  enableCorona: boolean;
  /** Star count for the background field. */
  starCount: number;
  /** User / OS asked us to keep motion calm. */
  reducedMotion: boolean;
  resolved: boolean;
  resolve: () => void;
  setTier: (tier: QualityTier) => void;
}

const PRESETS: Record<QualityTier, Omit<QualityState, "tier" | "reducedMotion" | "resolved" | "resolve" | "setTier">> = {
  low: { dpr: [1, 1], sunSegments: 48, enableCorona: false, starCount: 900 },
  medium: { dpr: [1, 1.5], sunSegments: 96, enableCorona: true, starCount: 1800 },
  high: { dpr: [1, 2], sunSegments: 160, enableCorona: true, starCount: 3500 },
};

/**
 * Heuristic device tier. Runs once on the client. We deliberately err toward
 * "low" so weak laptops / phones get a buttery scroll rather than a pretty stutter.
 */
function detectTier(): { tier: QualityTier; reducedMotion: boolean } {
  if (typeof window === "undefined") {
    return { tier: "medium", reducedMotion: false };
  }

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const cores = navigator.hardwareConcurrency ?? 4;
  // deviceMemory is Chromium-only; treat missing as "unknown but okay".
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const isCoarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 720;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ?? false;

  let score = 0;
  score += cores >= 8 ? 2 : cores >= 4 ? 1 : 0;
  score += memory >= 8 ? 2 : memory >= 4 ? 1 : 0;
  score += isCoarse || narrow ? -1 : 1; // phones/tablets pay a penalty
  if (saveData || reducedMotion) score -= 2;

  let tier: QualityTier = "medium";
  if (score >= 4) tier = "high";
  else if (score <= 1) tier = "low";

  return { tier, reducedMotion };
}

export const useQuality = create<QualityState>((set) => ({
  tier: "medium",
  reducedMotion: false,
  resolved: false,
  ...PRESETS.medium,
  resolve: () =>
    set((state) => {
      if (state.resolved) return state;
      const { tier, reducedMotion } = detectTier();
      return { ...PRESETS[tier], tier, reducedMotion, resolved: true };
    }),
  setTier: (tier) => set({ ...PRESETS[tier], tier }),
}));
