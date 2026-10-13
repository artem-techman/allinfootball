"use client";

import { useState } from "react";

const ERRORS: Record<string, string> = {
  invalid_email: "That doesn't look like an email address.",
  email_unavailable: "Sign-in by email isn't available just yet. Your club is saved on this device.",
  too_soon: "We just sent a code. Give it a moment before asking for another.",
  too_many: "Too many codes requested. Try again in an hour.",
  invalid: "That code isn't right. Check the email and try again.",
  expired: "That code has expired. Ask for a new one.",
  locked: "Too many wrong tries. Ask for a new code.",
  unavailable: "Something went wrong on our side. Try again in a minute.",
};

/** Email → 6-digit code → signed in. No passwords. */
export function EmailSignIn({ onDone, compact = false }: { onDone: () => void; compact?: boolean }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, body: unknown): Promise<{ ok?: boolean; error?: string }> {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.json().catch(() => ({ error: "unavailable" }));
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const r = await post("/api/auth/start", { email });
    setBusy(false);
    if (r.ok) setStep("code");
    else setError(ERRORS[r.error ?? "unavailable"] ?? ERRORS.unavailable);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await post("/api/auth/verify", { email, code });
    setBusy(false);
    if (r.ok) onDone();
    else setError(ERRORS[r.error ?? "unavailable"] ?? ERRORS.unavailable);
  }

  const input =
    "w-full rounded-tile border border-hairline bg-card-2 px-3.5 py-2.5 text-body text-text-primary placeholder:text-text-muted focus:border-accent-lime focus:outline-none";
  const button =
    "rounded-tile bg-accent-gradient px-4 py-2.5 text-meta font-bold text-text-on-accent disabled:opacity-50";

  return (
    <div className={compact ? "" : "max-w-sm"}>
      {step === "email" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-2.5 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Email</span>
            <input type="email" required autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </label>
          <button type="submit" disabled={busy} className={button}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-2.5">
          <p className="text-meta text-text-secondary">
            We sent a 6-digit code to <span className="font-semibold text-text-primary">{email}</span>.
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <label className="flex-1">
              <span className="sr-only">Code</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className={`${input} tabular tracking-[0.3em]`}
              />
            </label>
            <button type="submit" disabled={busy || code.length !== 6} className={button}>
              {busy ? "Checking…" : "Sign in"}
            </button>
          </div>
          <div className="flex gap-4 text-[12px] text-text-muted">
            <button type="button" onClick={() => sendCode()} className="hover:text-text-primary">Send a new code</button>
            <button type="button" onClick={() => setStep("email")} className="hover:text-text-primary">Use another email</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="mt-2.5 text-meta text-live-red">{error}</p>}
    </div>
  );
}
