"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crest } from "@/components/primitives/Crest";
import { ClubPicker, type PickedClub } from "./ClubPicker";
import { EmailSignIn } from "./EmailSignIn";

/**
 * First-time My Club setup: 1) pick a club, 2) sign in with email + code so it
 * follows you to any device and unlocks the matchday email. Step 2 can be
 * skipped — the club is already saved on this device.
 */
export function MyClubOnboarding({ signedIn, canSignIn }: { signedIn: boolean; canSignIn: boolean }) {
  const router = useRouter();
  const [club, setClub] = useState<PickedClub | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(c: PickedClub) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clubId: c.id }) });
    setBusy(false);
    if (!res.ok) {
      setError("We couldn't save that club. Try again.");
      return;
    }
    // No sign-in step when it can't work (email not configured) or isn't needed.
    if (signedIn || !canSignIn) router.refresh();
    else setClub(c);
  }

  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      {!club ? (
        <>
          {canSignIn && <p className="text-[11px] font-bold uppercase tracking-wide text-accent-lime">Step 1 of 2</p>}
          <h2 className="mt-1 text-section text-text-primary">Which club do you follow?</h2>
          <p className="mb-5 mt-1 text-meta text-text-secondary">Its next match, results and table, front and centre.</p>
          <ClubPicker onPick={pick} busy={busy} />
          {error && <p role="alert" className="mt-3 text-meta text-live-red">{error}</p>}
        </>
      ) : (
        <>
          <p className="text-[11px] font-bold uppercase tracking-wide text-accent-lime">Step 2 of 2</p>
          <div className="mt-2 flex items-center gap-3">
            <Crest src={club.crest} name={club.name} size={36} />
            <h2 className="text-section text-text-primary">{club.name} it is.</h2>
          </div>
          <p className="mb-5 mt-3 text-meta text-text-secondary">
            Sign in with your email to keep {club.name} on every device and get the matchday email: lineups before
            kickoff, the result and scorers at full time. No password, just a code.
          </p>
          <EmailSignIn onDone={() => router.refresh()} />
          <button type="button" onClick={() => router.refresh()} className="mt-4 text-meta text-text-muted hover:text-text-primary">
            Not now, keep it on this device
          </button>
        </>
      )}
    </section>
  );
}
