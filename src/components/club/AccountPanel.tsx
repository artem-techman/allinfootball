"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmailSignIn } from "./EmailSignIn";

/** Account box on My Club: sign in, matchday email switch, change club, sign out. */
export function AccountPanel({
  email,
  matchdayEmail,
  clubName,
  canSignIn,
}: {
  email: string | null;
  matchdayEmail: boolean;
  clubName: string;
  canSignIn: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(matchdayEmail);
  const [busy, setBusy] = useState(false);

  async function post(path: string, body: unknown) {
    setBusy(true);
    await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
    setBusy(false);
  }

  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <h3 className="text-cardtitle text-text-primary">Your account</h3>
      {email ? (
        <>
          <p className="mt-1 text-meta text-text-secondary">
            Signed in as <span className="font-semibold text-text-primary">{email}</span>
          </p>
          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={on}
              disabled={busy}
              onChange={async (e) => {
                setOn(e.target.checked);
                await post("/api/me", { matchdayEmail: e.target.checked });
              }}
              className="mt-0.5 h-4 w-4 accent-[var(--accent-lime)]"
            />
            <span className="text-meta text-text-primary">
              Matchday email for {clubName}
              <span className="block text-[12px] text-text-muted">Lineups about an hour before kickoff, then the result and scorers.</span>
            </span>
          </label>
        </>
      ) : canSignIn ? (
        <>
          <p className="mb-4 mt-1 text-meta text-text-secondary">
            Sign in to keep {clubName} on every device and get the matchday email. No password, just a code.
          </p>
          <EmailSignIn compact onDone={() => router.refresh()} />
        </>
      ) : (
        <p className="mt-1 text-meta text-text-secondary">
          {clubName} is saved on this device. Accounts and the matchday email are coming soon.
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-4 border-t border-hairline pt-4 text-meta">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            await post("/api/me", { clubId: null });
            router.refresh();
          }}
          className="font-semibold text-text-secondary hover:text-text-primary"
        >
          Change club
        </button>
        {email && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              await post("/api/auth/logout", {});
              router.refresh();
            }}
            className="font-semibold text-text-secondary hover:text-text-primary"
          >
            Sign out
          </button>
        )}
      </div>
    </section>
  );
}
