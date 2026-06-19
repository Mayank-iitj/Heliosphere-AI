"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { Panel } from "@/components/ui/primitives";

interface Msg {
  role: "user" | "assistant";
  text: string;
  grounded?: string[];
  model?: string;
}

const SUGGESTIONS = [
  "Is there any flare risk right now?",
  "Summarise current space-weather conditions",
  "What's the satellite & GNSS risk?",
  "Are geomagnetic storm conditions likely?",
];

export default function CopilotPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "I'm HelioGPT. Ask me about current solar conditions, flare forecasts, or operational risk — every answer is grounded on the live feed.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setBusy(true);
    try {
      const reply = await api.copilot(question);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: reply.answer, grounded: reply.grounded_on, model: reply.model },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "I couldn't reach the live feed just now. Please retry." },
      ]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Panel className="flex h-[72vh] flex-col p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--color-solar-500)] px-4 py-2.5 text-sm text-black"
                    : "max-w-[85%] rounded-2xl rounded-bl-sm border border-[var(--color-panel-border)] bg-[var(--color-space-900)]/60 px-4 py-3 text-sm"
                }
              >
                <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                {m.grounded && (
                  <details className="mt-2 text-[11px] text-[var(--color-ink-faint)]">
                    <summary className="cursor-pointer select-none hover:text-[var(--color-ink-muted)]">
                      Grounded on {m.grounded.length} facts · {m.model}
                    </summary>
                    <ul className="mt-1.5 space-y-0.5">
                      {m.grounded.map((g, gi) => (
                        <li key={gi}>• {g}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border border-[var(--color-panel-border)] bg-[var(--color-space-900)]/60 px-4 py-3 text-sm text-[var(--color-ink-muted)]">
                Analysing live feed…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-[var(--color-panel-border)] p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={busy}
                className="rounded-full border border-[var(--color-panel-border)] px-3 py-1.5 text-xs text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-solar-400)] hover:text-[var(--color-ink)] disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask HelioGPT about current conditions…"
              className="flex-1 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-space-900)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-solar-400)]"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-xl bg-[var(--color-solar-500)] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[var(--color-solar-400)] disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </Panel>
    </div>
  );
}
