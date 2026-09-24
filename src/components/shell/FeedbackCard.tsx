"use client";

import { useEffect, useState } from "react";
import { isValidEmailOptional, isValidMessage, MESSAGE_MAX } from "@/lib/feedback/config";

/**
 * Feedback widget (sidebar, replaced the Messi-shirt raffle). Flow:
 *   prompt ("Leave feedback") → form (rating + message + optional email) → thanks.
 *
 * Fold state persists in localStorage so a collapsed card stays collapsed; once
 * submitted this session the card shows the thank-you. Stored server-side via
 * /api/feedback.
 */

const STORAGE_KEY = "myfootballtracker.feedback.v1";

type Step = "prompt" | "form" | "done";

function loadFolded(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "folded";
  } catch {
    return false;
  }
}

function newSessionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function FeedbackCard() {
  const [mounted, setMounted] = useState(false);
  const [folded, setFolded] = useState(false);
  const [step, setStep] = useState<Step>("prompt");
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFolded(loadFolded());
    setMounted(true);
  }, []);

  function toggleFold() {
    setFolded((f) => {
      const next = !f;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "folded" : "open");
      } catch {
        /* private mode */
      }
      return next;
    });
  }

  async function submit() {
    if (!isValidMessage(message) || submitting) return;
    setSubmitting(true);
    setFailed(false);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          rating: rating ?? undefined,
          email: email.trim() || undefined,
          page: typeof window !== "undefined" ? window.location.pathname : undefined,
          sessionId: newSessionId(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (data.ok) setStep("done");
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted) {
    return <div aria-hidden className="h-[112px] rounded-lg2 border border-hairline bg-card" />;
  }

  /* ------------------------------ folded pill ------------------------------ */
  if (folded) {
    return (
      <button
        type="button"
        onClick={toggleFold}
        aria-expanded={false}
        aria-label="Show the feedback form"
        className="flex w-full items-center justify-between rounded-lg2 border border-hairline bg-card px-3.5 py-2 transition-colors hover:border-[rgba(91,200,80,0.5)]"
      >
        <span className="rounded-full bg-accent-gradient px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-text-on-accent">
          Leave feedback
        </span>
        <span aria-hidden className="text-[13px] leading-none text-text-muted">
          ⌃
        </span>
      </button>
    );
  }

  /* -------------------------------- prompt -------------------------------- */
  if (step === "prompt") {
    return (
      <Card onFold={toggleFold}>
        <h4 className="mb-0.5 text-[12.5px] font-bold leading-snug text-text-primary">
          Enjoying My Football Tracker?
        </h4>
        <p className="mb-2.5 text-[10.5px] leading-snug text-text-secondary">
          Tell us what you love or what&apos;s missing — it shapes what we build next.
        </p>
        <button
          type="button"
          onClick={() => setStep("form")}
          className="w-full rounded-md bg-accent-gradient px-2 py-1.5 text-[12px] font-bold text-text-on-accent transition-opacity hover:opacity-90"
        >
          Leave feedback
        </button>
      </Card>
    );
  }

  /* --------------------------------- done --------------------------------- */
  if (step === "done") {
    return (
      <Card onFold={toggleFold}>
        <div className="py-1 text-center">
          <div aria-hidden className="mb-1 text-[24px] leading-none">
            🙏
          </div>
          <h4 className="text-[13px] font-bold text-text-primary">Thanks for the feedback!</h4>
          <p className="mt-1 text-[10.5px] leading-snug text-text-secondary">
            We read every note. {email.trim() ? "We'll be in touch if a reply helps." : ""}
          </p>
        </div>
      </Card>
    );
  }

  /* --------------------------------- form --------------------------------- */
  const messageOk = isValidMessage(message);
  const emailOk = isValidEmailOptional(email);
  return (
    <Card onFold={toggleFold}>
      <h4 className="mb-2 text-[12.5px] font-bold leading-snug text-text-primary">Leave feedback</h4>

      {/* optional rating */}
      <div className="mb-2 flex items-center gap-1" role="radiogroup" aria-label="Rate your experience (optional)">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating((r) => (r === n ? null : n))}
            className={`text-[17px] leading-none transition-transform hover:scale-110 ${
              rating != null && n <= rating ? "text-star-gold" : "text-text-muted"
            }`}
          >
            {rating != null && n <= rating ? "★" : "☆"}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <textarea
          value={message}
          maxLength={MESSAGE_MAX}
          rows={3}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What's on your mind?"
          aria-label="Your feedback"
          className="w-full resize-none rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] leading-snug text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-[rgba(91,200,80,0.6)]"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional, for a reply)"
          aria-label="Your email (optional)"
          className={`w-full rounded-md border bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-muted ${
            email && !emailOk ? "border-live-red" : "border-white/10 focus:border-[rgba(91,200,80,0.6)]"
          }`}
        />
        <button
          type="button"
          disabled={!messageOk || !emailOk || submitting}
          onClick={() => void submit()}
          className="w-full rounded-md bg-accent-gradient px-2 py-1.5 text-[12px] font-bold text-text-on-accent transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Sending…" : "Send feedback"}
        </button>
        {failed && (
          <p role="alert" className="text-[10px] leading-snug text-live-red">
            Couldn&apos;t send just now — please try again in a moment.
          </p>
        )}
      </div>
    </Card>
  );
}

/* -------------------------------- pieces --------------------------------- */

function Card({ onFold, children }: { onFold: () => void; children: React.ReactNode }) {
  return (
    <section aria-label="Feedback" className="rounded-lg2 border border-hairline bg-card p-3.5">
      <header className="mb-2.5 flex items-center justify-between">
        <span className="rounded-full bg-accent-gradient px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-text-on-accent">
          Feedback
        </span>
        <button
          type="button"
          onClick={onFold}
          aria-expanded
          aria-label="Hide the feedback form"
          title="Fold away"
          className="grid h-5 w-5 place-items-center rounded-full text-[13px] leading-none text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
        >
          ⌄
        </button>
      </header>
      {children}
    </section>
  );
}
