"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { POLL_QUESTIONS } from "@/lib/poll/questions";

/**
 * Fan Pulse — the sidebar micro-poll (replaces the ad banner). One question at a
 * time; tap an answer to vote, see the community split, move on. Anonymous: a
 * random device id in localStorage, no PII (see the privacy policy). Votes go to
 * /api/poll; the widget works offline-ish (answers persist locally even if the
 * network call fails) and never blocks the sidebar.
 */

const STORAGE_KEY = "allinfootball.pulse.v1";

interface PulseState {
  sid: string;
  answers: Record<string, string>;
}

type Results = Record<string, Record<string, number>>;

function loadState(): PulseState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PulseState>;
      if (parsed.sid && parsed.answers) return { sid: parsed.sid, answers: parsed.answers };
    }
  } catch {
    /* fall through to a fresh state */
  }
  const sid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return { sid, answers: {} };
}

function saveState(s: PulseState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* private mode — answers just won't persist */
  }
}

/** How long the community result stays on screen before the next question slides in. */
const ADVANCE_MS = 2000;

export function FanPulseCard() {
  const [state, setState] = useState<PulseState | null>(null); // null until mounted (localStorage)
  const [results, setResults] = useState<Results>({});
  const [idx, setIdx] = useState(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // never leave a pending auto-advance behind on unmount
  useEffect(() => () => clearTimer(), []);

  function clearTimer() {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }

  // Mount: load local state, jump to the first unanswered question, fetch results.
  useEffect(() => {
    const s = loadState();
    setState(s);
    const firstOpen = POLL_QUESTIONS.findIndex((q) => !s.answers[q.id]);
    setIdx(firstOpen === -1 ? 0 : firstOpen);
    fetch("/api/poll", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { results?: Results }) => setResults(d.results ?? {}))
      .catch(() => {});
  }, []);

  const question = POLL_QUESTIONS[idx];
  const answered = state ? state.answers[question?.id ?? ""] : undefined;
  const allDone = useMemo(
    () => (state ? POLL_QUESTIONS.every((q) => state.answers[q.id]) : false),
    [state],
  );

  if (!state || !question) {
    // pre-mount placeholder keeps the sidebar from jumping
    return <div aria-hidden className="h-[190px] rounded-lg2 border border-hairline bg-card" />;
  }

  function vote(optionId: string) {
    if (!state || answered) return;
    const next = { ...state, answers: { ...state.answers, [question.id]: optionId } };
    setState(next);
    saveState(next);
    // Optimistically fold our vote into the community numbers.
    setResults((r) => ({
      ...r,
      [question.id]: { ...r[question.id], [optionId]: (r[question.id]?.[optionId] ?? 0) + 1 },
    }));
    fetch("/api/poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id, optionId, sessionId: state.sid }),
    }).catch(() => {}); // local answer stands even if the network call fails

    // Let the community split land for a beat, then flow straight into the next
    // unanswered question — no tap needed.
    const upcoming = POLL_QUESTIONS.findIndex((q) => !next.answers[q.id]);
    if (upcoming !== -1) {
      clearTimer();
      advanceTimer.current = setTimeout(() => setIdx(upcoming), ADVANCE_MS);
    }
  }

  const counts = results[question.id] ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <section
      aria-label="Fan Pulse poll"
      className="rounded-lg2 border border-hairline bg-card p-3.5"
    >
      <header className="mb-2.5 flex items-center justify-between">
        <span className="rounded-full bg-accent-gradient px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-text-on-accent">
          Fan Pulse
        </span>
        <span className="tabular text-[10px] font-semibold text-text-muted">
          {Math.min(Object.keys(state.answers).length + (allDone ? 0 : 1), POLL_QUESTIONS.length)}/
          {POLL_QUESTIONS.length}
        </span>
      </header>

      <h4 className="mb-2.5 text-[12.5px] font-semibold leading-snug text-text-primary">{question.text}</h4>

      {answered ? (
        <div className="space-y-1.5">
          {question.options.map((o) => {
            const n = counts[o.id] ?? 0;
            const pct = total > 0 ? Math.round((n / total) * 100) : 0;
            const mine = o.id === answered;
            return (
              <div key={o.id} className="relative overflow-hidden rounded-md border border-white/5 bg-white/[0.03]">
                <div
                  aria-hidden
                  className={`absolute inset-y-0 left-0 transition-[width] duration-500 ${
                    mine ? "bg-accent-gradient opacity-90" : "bg-white/10"
                  }`}
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between px-2 py-1">
                  <span className={`truncate text-[11px] font-medium ${mine ? "font-bold text-text-on-accent" : "text-text-secondary"}`}>
                    {o.label}
                  </span>
                  <span className={`tabular shrink-0 pl-1.5 text-[10px] font-bold ${mine ? "text-text-on-accent" : "text-text-muted"}`}>
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-text-muted">
              {allDone
                ? idx === POLL_QUESTIONS.length - 1
                  ? "Full time — thanks for playing!"
                  : "How the crowd voted"
                : "Nice one — next up…"}
            </span>
            <div className="flex gap-1">
              {idx > 0 && (
                <NavBtn
                  label="Previous question"
                  onClick={() => {
                    clearTimer();
                    setIdx((i) => i - 1);
                  }}
                >
                  ‹
                </NavBtn>
              )}
              {idx < POLL_QUESTIONS.length - 1 && (
                <NavBtn
                  label="Next question"
                  onClick={() => {
                    clearTimer();
                    setIdx((i) => i + 1);
                  }}
                >
                  ›
                </NavBtn>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {question.options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => vote(o.id)}
              className="block w-full rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-left text-[11px] font-medium text-text-secondary transition-colors hover:border-[rgba(91,200,80,0.6)] hover:text-text-primary"
            >
              {o.label}
            </button>
          ))}
          <p className="pt-1 text-[10px] text-text-muted">Anonymous · no VAR checks</p>
        </div>
      )}
    </section>
  );
}

function NavBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-6 w-6 place-items-center rounded-full border border-white/10 text-[13px] leading-none text-text-secondary transition-colors hover:border-[rgba(91,200,80,0.6)] hover:text-text-primary"
    >
      {children}
    </button>
  );
}
