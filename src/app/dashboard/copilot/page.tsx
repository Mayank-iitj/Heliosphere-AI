"use client";

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { Panel } from "@/components/ui/primitives";

interface Msg {
  role: "user" | "assistant";
  text: string;
  grounded?: string[];
  model?: string;
}

const SUGGESTIONS = [
  { label: "Current status", q: "Give me a brief operational summary of current solar conditions for Aditya-L1" },
  { label: "Flare risk", q: "What is the current flare risk and what do SoLEXS and HEL1OS see right now?" },
  { label: "VELC conditions", q: "Are corona conditions favourable for VELC imaging today?" },
  { label: "Solar wind", q: "What are ASPEX and PAPA measuring in the solar wind right now?" },
  { label: "Geomagnetic storm", q: "Is there any geomagnetic storm risk and how does it affect Aditya-L1 operations?" },
  { label: "IMF Bz", q: "What is the current IMF Bz from MAG and is it geoeffective?" },
  { label: "Operational risk", q: "Summarise all operational risks for Aditya-L1 systems right now" },
];

const MODEL_LABELS: Record<string, string> = {
  "llama-3.3-70b-versatile (Groq)": "Groq · LLaMA 3.3 70B",
  "helio-rules-v2 (offline)": "HelioRules · Offline",
  "helio-rules-v1": "HelioRules · Offline",
};

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </span>
  );
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Namaste! I'm HelioGPT, the AI copilot for Aditya-L1 operations.\n\nI'm grounded on live solar data — every answer uses real measured values from the spacecraft's instruments. Ask me about solar conditions, flare forecasts, payload status, or operational risk.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () =>
    requestAnimationFrame(() =>
      endRef.current?.scrollIntoView({ behavior: "smooth" })
    );

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setBusy(true);
    scrollToBottom();
    try {
      const reply = await api.copilot(question);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: reply.answer,
          grounded: reply.grounded_on,
          model: reply.model,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: "I couldn't reach the live data feed right now. Please check that the backend is running and retry.",
        },
      ]);
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-ink)]">HelioGPT</h1>
          <p className="text-xs text-[var(--color-ink-faint)]">
            Aditya-L1 mission copilot · grounded on live solar telemetry
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[var(--color-panel-border)] bg-[var(--color-space-900)]/60 px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[11px] font-mono text-[var(--color-ink-faint)]">
            Groq · LLaMA 3.3 70B
          </span>
        </div>
      </div>

      {/* Quick suggestions */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => send(s.q)}
            disabled={busy}
            className="rounded-full border border-[var(--color-panel-border)] px-3 py-1.5 text-xs text-[var(--color-ink-muted)] transition-all duration-200 hover:border-[var(--color-solar-400)] hover:text-[var(--color-ink)] hover:bg-[var(--color-solar-500)]/10 disabled:opacity-40"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Chat window */}
      <Panel className="flex flex-col p-0 overflow-hidden" style={{ height: "calc(100vh - 20rem)" }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 p-5 scroll-smooth">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start gap-3"}
              >
                {m.role === "assistant" && (
                  <div className="mt-1 shrink-0 h-7 w-7 rounded-full bg-gradient-to-br from-[var(--color-solar-400)] to-[var(--color-solar-600)] flex items-center justify-center text-[10px] font-bold text-black">
                    HG
                  </div>
                )}
                <div className="max-w-[82%]">
                  <div
                    className={
                      m.role === "user"
                        ? "rounded-2xl rounded-br-sm bg-gradient-to-br from-[var(--color-solar-500)] to-[var(--color-solar-600)] px-4 py-2.5 text-sm text-black shadow-lg"
                        : "rounded-2xl rounded-bl-sm border border-[var(--color-panel-border)] bg-[var(--color-space-900)]/80 px-4 py-3 text-sm shadow-md"
                    }
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                  </div>
                  {m.grounded && (
                    <details className="mt-1.5 text-[10px] text-[var(--color-ink-faint)]">
                      <summary className="cursor-pointer select-none hover:text-[var(--color-ink-muted)] list-none flex items-center gap-1">
                        <span className="h-1 w-1 rounded-full bg-green-400 inline-block" />
                        Grounded on {m.grounded.length} live data points
                        {m.model && (
                          <span className="ml-1 rounded-full bg-[var(--color-space-800)] px-1.5 py-0.5">
                            {MODEL_LABELS[m.model] ?? m.model}
                          </span>
                        )}
                      </summary>
                      <ul className="mt-1.5 ml-3 space-y-0.5 border-l border-[var(--color-panel-border)] pl-3">
                        {m.grounded.map((g, gi) => (
                          <li key={gi} className="font-mono">{g}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {busy && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3"
            >
              <div className="mt-1 h-7 w-7 rounded-full bg-gradient-to-br from-[var(--color-solar-400)] to-[var(--color-solar-600)] flex items-center justify-center text-[10px] font-bold text-black shrink-0">
                HG
              </div>
              <div className="rounded-2xl rounded-bl-sm border border-[var(--color-panel-border)] bg-[var(--color-space-900)]/80 px-4 py-3 text-sm text-[var(--color-ink-muted)]">
                <TypingDots />
              </div>
            </motion.div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-[var(--color-panel-border)] bg-[var(--color-space-950)]/60 p-4 backdrop-blur">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask HelioGPT about Aditya-L1 conditions, payloads, or solar risk…"
              disabled={busy}
              className="flex-1 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-space-900)] px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-solar-400)] disabled:opacity-60 placeholder:text-[var(--color-ink-faint)]"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-xl bg-gradient-to-br from-[var(--color-solar-400)] to-[var(--color-solar-600)] px-5 py-2.5 text-sm font-semibold text-black transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
            >
              {busy ? <TypingDots /> : "Send"}
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-[var(--color-ink-faint)]">
            All answers grounded on live Aditya-L1 telemetry · Powered by Groq LLaMA 3.3 70B
          </p>
        </div>
      </Panel>
    </div>
  );
}
