"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  AGE_OPTIONS,
  SPEND_OPTIONS,
  NAME_MAX,
  TEAM_MAX,
  isValidEmail,
  isValidName,
  isValidTeam,
} from "@/lib/raffle/config";

/**
 * Messi-shirt raffle (sidebar widget, replaces Fan Pulse). Flow:
 *   banner ("Join the raffle") → register (name + email) → confirm (3 quick
 *   questions: age → favourite team → season spend) → you're in.
 *
 * Progress persists in localStorage so a half-done entry resumes where it left
 * off; the card folds to a slim pill like Fan Pulse did. Email double-opt-in is
 * intentionally NOT sent yet (no email provider configured) — entries are
 * stored unverified and the schema is ready for it.
 */

const STORAGE_KEY = "allinfootball.raffle.v1";

type Step = "banner" | "register" | "confirm" | "done";

interface RaffleState {
  sid: string;
  step: Step;
  name: string;
  email: string;
  age?: string;
  team?: string;
  spend?: string;
  folded?: boolean;
}

// True once the widget has mounted in this JS session. The sidebar remounts on
// every client-side navigation; this flag makes the reset-to-banner apply only
// to a FRESH visit (full page load), not to moving between pages mid-flow.
let sessionStarted = false;

function freshState(): RaffleState {
  const sid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return { sid, step: "banner", name: "", email: "" };
}

function loadState(): RaffleState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<RaffleState>;
      if (p.sid && p.step) return { ...freshState(), ...p, sid: p.sid, step: p.step };
    }
  } catch {
    /* fresh */
  }
  return freshState();
}

function saveState(s: RaffleState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
}

export function RaffleCard() {
  const [state, setState] = useState<RaffleState | null>(null);
  const [count, setCount] = useState(0);
  const [confirmStep, setConfirmStep] = useState(0); // 0 age · 1 team · 2 spend
  const [tapped, setTapped] = useState<string | null>(null); // flash on one-tap answers
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  // email that came back as "already entered" — blocks Continue until changed
  const [dupEmail, setDupEmail] = useState<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const s = loadState();
    // Fresh visit → always greet with the banner (folded stays respected; the
    // name/email/answers are kept so a returning entrant never retypes them).
    if (!sessionStarted) {
      sessionStarted = true;
      if (s.step !== "banner") {
        s.step = "banner";
        saveState(s);
      }
    }
    setState(s);
    if (s.step === "confirm") setConfirmStep(s.age ? (s.team ? 2 : 1) : 0);
    fetch("/api/raffle", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { count?: number }) => setCount(d.count ?? 0))
      .catch(() => {});
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  if (!state) {
    return <div aria-hidden className="h-[220px] rounded-lg2 border border-hairline bg-card" />;
  }

  function update(patch: Partial<RaffleState>) {
    setState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveState(next);
      return next;
    });
  }

  function toggleFold() {
    update({ folded: !state?.folded });
  }

  async function submit(final: Partial<RaffleState>) {
    const s = { ...state!, ...final };
    setSubmitting(true);
    setFailed(false);
    try {
      const res = await fetch("/api/raffle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: s.name,
          email: s.email,
          age: s.age,
          team: s.team,
          spend: s.spend,
          sessionId: s.sid,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; already?: boolean };
      if (data.ok && data.already) {
        // This email already holds an entry — bounce back to the register step
        // and ask for a different one (answers are kept, so a corrected email
        // resubmits without redoing the questions).
        setDupEmail(s.email.trim().toLowerCase());
        update({ ...final, step: "register" });
      } else if (data.ok) {
        setCount((c) => c + 1);
        update({ ...final, step: "done" });
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  }

  /* ------------------------------ folded pill ------------------------------ */
  if (state.folded) {
    return (
      <button
        type="button"
        onClick={toggleFold}
        aria-expanded={false}
        aria-label="Show the Messi shirt raffle"
        className="flex w-full items-center justify-between rounded-lg2 border border-hairline bg-card px-3.5 py-2 transition-colors hover:border-[rgba(91,200,80,0.5)]"
      >
        <span className="rounded-full bg-accent-gradient px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-text-on-accent">
          Win a Messi shirt
        </span>
        <span aria-hidden className="text-[13px] leading-none text-text-muted">
          ⌃
        </span>
      </button>
    );
  }

  /* -------------------------------- banner -------------------------------- */
  if (state.step === "banner") {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => update({ step: "register" })}
          aria-label="Join the raffle — win a signed Messi shirt"
          className="block w-full overflow-hidden rounded-lg2 shadow-soft transition-transform duration-200 hover:scale-[1.02] focus-visible:scale-[1.02]"
        >
          <Image
            src="/raffle-messi.png"
            alt="Win a signed Messi shirt — join the raffle"
            width={800}
            height={800}
            className="h-auto w-full"
          />
        </button>
        {count >= 10 && (
          <p className="mt-1.5 text-center text-[10px] text-text-muted">
            🎟 {count.toLocaleString()} fans already in
          </p>
        )}
        <button
          type="button"
          onClick={toggleFold}
          aria-label="Hide the raffle"
          title="Fold away"
          className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-[13px] leading-none text-white/70 backdrop-blur-sm transition-colors hover:text-white"
        >
          ⌄
        </button>
      </div>
    );
  }

  /* ------------------------------- register ------------------------------- */
  if (state.step === "register") {
    const nameOk = isValidName(state.name);
    const emailOk = isValidEmail(state.email);
    const isDup = dupEmail !== null && state.email.trim().toLowerCase() === dupEmail;
    // Answers already given (e.g. coming back after a duplicate-email bounce):
    // a corrected email re-submits directly instead of replaying the questions.
    const answersDone = Boolean(state.age && state.team && state.spend);
    return (
      <Card onFold={toggleFold} badge="Messi shirt raffle">
        <h4 className="mb-0.5 text-[12.5px] font-bold leading-snug text-text-primary">
          Register your participation
        </h4>
        <p className="mb-2.5 text-[10.5px] leading-snug text-text-secondary">
          Two lines and you&apos;re on the team sheet.
        </p>
        <div className="space-y-1.5">
          <input
            type="text"
            value={state.name}
            maxLength={NAME_MAX}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Your name"
            aria-label="Your name"
            className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-[rgba(91,200,80,0.6)]"
          />
          <input
            type="email"
            value={state.email}
            onChange={(e) => update({ email: e.target.value })}
            placeholder="you@email.com"
            aria-label="Your email"
            className={`w-full rounded-md border bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-muted ${
              isDup
                ? "border-[rgba(91,200,80,0.6)]"
                : "border-white/10 focus:border-[rgba(91,200,80,0.6)]"
            }`}
          />
          {isDup && (
            <p role="status" className="text-[10px] leading-snug text-accent-lime">
              🎟️ That email is already entered — you&apos;re all set.
            </p>
          )}
          <button
            type="button"
            disabled={!nameOk || !emailOk || isDup || submitting}
            onClick={() => {
              if (answersDone) void submit({});
              else update({ step: "confirm" });
            }}
            className="w-full rounded-md bg-accent-gradient px-2 py-1.5 text-[12px] font-bold text-text-on-accent transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Registering…" : "Continue →"}
          </button>
          {failed && !isDup && (
            <p role="alert" className="text-[10px] leading-snug text-live-red">
              Couldn&apos;t reach the stadium — give it another go.
            </p>
          )}
        </div>
        <p className="mt-2 text-[9.5px] leading-snug text-text-muted">
          18+ · No purchase necessary. By entering you agree to occasional emails from My Football
          Tracker.
        </p>
      </Card>
    );
  }

  /* ------------------------------- confirm -------------------------------- */
  if (state.step === "confirm") {
    const first = state.name.trim().split(/\s+/)[0];

    function tapAnswer(patch: Partial<RaffleState>, nextStep: number | "submit", id: string) {
      setTapped(id);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        setTapped(null);
        update(patch);
        if (nextStep === "submit") {
          void submit(patch);
        } else {
          setConfirmStep(nextStep);
        }
      }, 350);
    }

    return (
      <Card onFold={toggleFold} badge="Messi shirt raffle" counter={`${confirmStep + 1}/3`}>
        <h4 className="mb-0.5 text-[12.5px] font-bold leading-snug text-text-primary">
          Confirm your participation
        </h4>

        {submitting ? (
          <p className="py-4 text-center text-[11.5px] text-text-secondary">Stamping your ticket…</p>
        ) : failed ? (
          <div className="py-2 text-center">
            <p className="mb-2 text-[11.5px] text-text-secondary">
              Couldn&apos;t reach the stadium — give it another go.
            </p>
            <button
              type="button"
              onClick={() => void submit({})}
              className="rounded-md bg-accent-gradient px-3 py-1.5 text-[11.5px] font-bold text-text-on-accent"
            >
              Retry
            </button>
          </div>
        ) : confirmStep === 0 ? (
          <>
            <p className="mb-2 text-[10.5px] text-text-secondary">
              Quick one, {first} — which age squad are you in?
            </p>
            <div className="space-y-1.5">
              {AGE_OPTIONS.map((o) => (
                <TapOption key={o.id} label={o.label} flashing={tapped === o.id} onTap={() => tapAnswer({ age: o.id }, 1, o.id)} />
              ))}
            </div>
          </>
        ) : confirmStep === 1 ? (
          <TeamStep
            initial={state.team ?? ""}
            onNext={(team) => {
              update({ team });
              setConfirmStep(2);
            }}
          />
        ) : (
          <>
            <p className="mb-2 text-[10.5px] text-text-secondary">
              Last one — what does football cost you a year? Tickets, shirts, bets, FIFA points…
            </p>
            <div className="space-y-1.5">
              {SPEND_OPTIONS.map((o) => (
                <TapOption key={o.id} label={o.label} flashing={tapped === o.id} onTap={() => tapAnswer({ spend: o.id }, "submit", o.id)} />
              ))}
            </div>
          </>
        )}
      </Card>
    );
  }

  /* --------------------------------- done --------------------------------- */
  const first = state.name.trim().split(/\s+/)[0] || "legend";
  return (
    <Card onFold={toggleFold} badge="Messi shirt raffle">
      <div className="py-1 text-center">
        <div aria-hidden className="mb-1 text-[26px] leading-none">
          🎟️
        </div>
        <h4 className="text-[13px] font-bold text-text-primary">You&apos;re in, {first}!</h4>
        <p className="mt-1 text-[10.5px] leading-snug text-text-secondary">
          Ticket registered{count >= 10 ? ` — you and ${Math.max(count - 1, 1).toLocaleString()} other fans` : ""}.
          Winner announced soon. Good luck!
        </p>
      </div>
    </Card>
  );
}

/* -------------------------------- pieces --------------------------------- */

function Card({
  badge,
  counter,
  onFold,
  children,
}: {
  badge: string;
  counter?: string;
  onFold: () => void;
  children: React.ReactNode;
}) {
  return (
    <section aria-label="Messi shirt raffle" className="rounded-lg2 border border-hairline bg-card p-3.5">
      <header className="mb-2.5 flex items-center justify-between">
        <span className="rounded-full bg-accent-gradient px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-text-on-accent">
          {badge}
        </span>
        <span className="flex items-center gap-1.5">
          {counter && <span className="tabular text-[10px] font-semibold text-text-muted">{counter}</span>}
          <button
            type="button"
            onClick={onFold}
            aria-expanded
            aria-label="Hide the raffle"
            title="Fold away"
            className="grid h-5 w-5 place-items-center rounded-full text-[13px] leading-none text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
          >
            ⌄
          </button>
        </span>
      </header>
      {children}
    </section>
  );
}

function TapOption({ label, flashing, onTap }: { label: string; flashing: boolean; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={`block w-full rounded-md border px-2 py-1.5 text-left text-[11px] font-medium transition-colors ${
        flashing
          ? "border-transparent bg-accent-gradient font-bold text-text-on-accent"
          : "border-white/10 bg-white/[0.03] text-text-secondary hover:border-[rgba(91,200,80,0.6)] hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}

function TeamStep({ initial, onNext }: { initial: string; onNext: (team: string) => void }) {
  const [team, setTeam] = useState(initial);
  const ok = isValidTeam(team);
  return (
    <>
      <p className="mb-2 text-[10.5px] text-text-secondary">Who has your heart? Any club, any league.</p>
      <div className="space-y-1.5">
        <input
          type="text"
          value={team}
          maxLength={TEAM_MAX}
          onChange={(e) => setTeam(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && ok) onNext(team.trim());
          }}
          placeholder="e.g. Boca Juniors"
          aria-label="Your favourite team"
          className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-[rgba(91,200,80,0.6)]"
        />
        <button
          type="button"
          disabled={!ok}
          onClick={() => onNext(team.trim())}
          className="w-full rounded-md bg-accent-gradient px-2 py-1.5 text-[12px] font-bold text-text-on-accent transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </>
  );
}
