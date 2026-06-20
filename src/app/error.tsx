"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-level error boundary (Next.js App Router). Last line of defence: if any
 * page throws during render, the user sees a branded recovery screen with a
 * retry — never a raw "client-side exception" white screen.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <main className="grid min-h-[100svh] place-items-center px-6 text-center">
      <div className="max-w-md">
        <div
          className="mx-auto mb-8 h-24 w-24 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 38% 35%, #ffe39a 0%, #ff8a00 42%, #ff5e3a 70%, #7a1d00 100%)",
            boxShadow: "0 0 80px 20px rgba(255,138,0,0.35)",
          }}
        />
        <h1 className="text-2xl font-bold tracking-tight">Something went off-nominal</h1>
        <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
          A transient error interrupted this view. Telemetry has been logged — try
          again, or head back to mission control.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-[var(--color-solar-500)] px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.03] hover:bg-[var(--color-solar-400)]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-[var(--color-panel-border)] px-6 py-3 text-sm font-semibold transition-colors hover:border-[var(--color-solar-400)]"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
