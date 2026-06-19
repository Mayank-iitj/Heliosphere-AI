"use client";

import { useEffect, useState } from "react";
import { api, getToken, type Alert } from "@/lib/api";
import { Panel } from "@/components/ui/primitives";
import clsx from "clsx";

const LEVEL_META: Record<string, { color: string; label: string }> = {
  info: { color: "var(--color-risk-low)", label: "Info" },
  watch: { color: "var(--color-risk-moderate)", label: "Watch" },
  warning: { color: "var(--color-risk-high)", label: "Warning" },
  severe: { color: "var(--color-risk-severe)", label: "Severe" },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [authed, setAuthed] = useState(false);

  const load = () => api.alerts().then(setAlerts).catch(() => {});

  useEffect(() => {
    load();
    setAuthed(!!getToken());
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const ack = async (id: number) => {
    try {
      await api.acknowledgeAlert(id);
      load();
    } catch {
      alert("Acknowledging requires sign-in. The admin account is admin@heliosphere.ai.");
    }
  };

  const shown = alerts.filter((a) => filter === "all" || a.level === filter);
  const counts = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.level] = (acc[a.level] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["severe", "warning", "watch", "info"] as const).map((lvl) => (
          <button
            key={lvl}
            onClick={() => setFilter(filter === lvl ? "all" : lvl)}
            className={clsx(
              "glass rounded-xl p-4 text-left transition-colors",
              filter === lvl && "border-[var(--color-solar-400)]",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: LEVEL_META[lvl].color }} />
              <span className="text-[11px] uppercase tracking-widest text-[var(--color-ink-faint)]">
                {LEVEL_META[lvl].label}
              </span>
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold">{counts[lvl] ?? 0}</div>
          </button>
        ))}
      </div>

      <Panel
        title="Alert feed"
        subtitle={authed ? "Signed in — acknowledgement enabled" : "Sign in as admin to acknowledge"}
        action={
          filter !== "all" && (
            <button
              onClick={() => setFilter("all")}
              className="text-xs font-semibold text-[var(--color-solar-300)] hover:underline"
            >
              Clear filter
            </button>
          )
        }
      >
        {shown.length ? (
          <ul className="space-y-2">
            {shown.map((a) => {
              const meta = LEVEL_META[a.level] ?? LEVEL_META.info;
              return (
                <li
                  key={a.id}
                  className={clsx(
                    "flex items-start gap-3 rounded-xl border bg-[var(--color-space-900)]/40 px-4 py-3",
                    a.acknowledged
                      ? "border-[var(--color-panel-border)] opacity-60"
                      : "border-[var(--color-panel-border)]",
                  )}
                >
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{a.title}</span>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 15%, transparent)` }}
                      >
                        {meta.label}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-[var(--color-ink-faint)]">
                        {new Date(a.created_at).toUTCString().slice(5, 22)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-muted)]">{a.body}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-[10px] text-[var(--color-ink-faint)]">{a.source}</span>
                      {a.acknowledged ? (
                        <span className="text-[10px] font-semibold text-[var(--color-risk-low)]">
                          ✓ Acknowledged
                        </span>
                      ) : (
                        <button
                          onClick={() => ack(a.id)}
                          className="text-[10px] font-semibold text-[var(--color-solar-300)] hover:underline"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-[var(--color-ink-muted)]">
            No alerts in this view — conditions nominal.
          </p>
        )}
      </Panel>
    </div>
  );
}
