"use client";

import { useEffect, useState } from "react";
import { Crest } from "@/components/primitives/Crest";
import type { Match } from "@/lib/providers/types";

interface Candidate {
  playerId: number;
  name: string;
  teamId: number;
  number?: number;
}
interface Tally {
  playerId: number;
  name: string;
  teamId: number;
  votes: number;
}
interface State {
  open: boolean;
  candidates: Candidate[];
  tallies: Tally[];
  myVote: number | null;
}

/** Player of the Match: pick from both line-ups, then see how fans voted. */
export function PotmVote({ match }: { match: Match }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/potm?match=${match.id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: State) => !cancelled && setState(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [match.id]);

  if (!state || state.candidates.length === 0) return null;
  const voted = state.myVote != null;
  const showResults = voted || !state.open;

  async function vote(c: Candidate) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/potm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match: match.id, playerId: c.playerId }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("Your vote didn't go through. Try again.");
      return;
    }
    const { counted } = (await res.json()) as { counted: boolean };
    setState((s) => {
      if (!s) return s;
      const tallies = [...s.tallies];
      if (counted) {
        const t = tallies.find((x) => x.playerId === c.playerId);
        if (t) t.votes += 1;
        else tallies.push({ playerId: c.playerId, name: c.name, teamId: c.teamId, votes: 1 });
        tallies.sort((a, b) => b.votes - a.votes);
      }
      return { ...s, tallies, myVote: s.myVote ?? c.playerId };
    });
  }

  const total = state.tallies.reduce((n, t) => n + t.votes, 0);
  const crestFor = (teamId: number) => (teamId === match.homeTeamId ? match.homeTeam : match.awayTeam);

  return (
    <section className="mb-5 rounded-card border border-hairline bg-card p-card" aria-label="Player of the Match vote">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-cardtitle text-text-primary">Player of the Match</h3>
        <span className="text-[12px] text-text-muted">
          {total} vote{total === 1 ? "" : "s"}
          {!state.open && " · voting closed"}
        </span>
      </header>

      {showResults ? (
        <ol className="space-y-2">
          {state.tallies.slice(0, 5).map((t) => {
            const pct = total ? Math.round((t.votes / total) * 100) : 0;
            const team = crestFor(t.teamId);
            return (
              <li key={t.playerId}>
                <div className="flex items-center gap-2 text-meta">
                  <Crest src={team?.crest} name={team?.name ?? ""} size={16} />
                  <span className={`flex-1 truncate ${t.playerId === state.myVote ? "font-bold text-text-primary" : "text-text-primary"}`}>
                    {t.name}
                    {t.playerId === state.myVote && <span className="ml-1.5 text-[11px] font-semibold text-accent-lime">your vote</span>}
                  </span>
                  <span className="tabular font-bold text-text-primary">{pct}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-card-2">
                  <div className="h-full rounded-full bg-accent-gradient" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
          {state.tallies.length === 0 && <li className="text-meta text-text-secondary">No votes were cast.</li>}
        </ol>
      ) : (
        <>
          <p className="mb-3 text-meta text-text-secondary">Who was the best player on the pitch?</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[match.homeTeamId, match.awayTeamId].map((teamId) => {
              const team = crestFor(teamId);
              return (
                <div key={teamId}>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">
                    <Crest src={team?.crest} name={team?.name ?? ""} size={14} />
                    {team?.name}
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {state.candidates
                      .filter((c) => c.teamId === teamId)
                      .map((c) => (
                        <li key={c.playerId}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => vote(c)}
                            className="rounded-full border border-hairline bg-card-2 px-3 py-1.5 text-[12px] font-semibold text-text-primary transition-colors hover:border-accent-lime disabled:opacity-50"
                          >
                            {c.name}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
      {error && <p role="alert" className="mt-3 text-meta text-live-red">{error}</p>}
    </section>
  );
}
