import type { Match } from "@/lib/providers/types";
import { MatchCard } from "@/components/cards/MatchCard";
import { EmptyState } from "@/components/primitives/EmptyState";

/**
 * Competition fixtures (CLAUDE.md section 8) grouped by round/matchday, ordered
 * chronologically. Empty competitions (e.g. a tournament not yet scheduled) show
 * the empty state.
 */
export function CompetitionFixtures({ matches }: { matches: Match[] }) {
  if (matches.length === 0) {
    return <EmptyState title="No fixtures scheduled yet" hint="Check back when the schedule is published." />;
  }

  const byRound = new Map<string, Match[]>();
  for (const m of matches) {
    const round = m.round ?? "Fixtures";
    const arr = byRound.get(round) ?? [];
    arr.push(m);
    byRound.set(round, arr);
  }

  // A round is "upcoming" while any of its ties is still to be played. We lead
  // with upcoming rounds (soonest first) so the current stage — e.g. the World
  // Cup knockouts — is at the top, then list completed rounds most-recent first.
  const isPending = (m: Match) => m.status !== "finished" && m.status !== "cancelled" && m.status !== "abandoned";

  const groups = [...byRound.entries()]
    .map(([round, ms]) => {
      const sorted = ms.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
      return {
        round,
        matches: sorted,
        upcoming: sorted.some(isPending),
        first: sorted[0].kickoffUtc,
        last: sorted[sorted.length - 1].kickoffUtc,
      };
    })
    .sort((a, b) => {
      if (a.upcoming !== b.upcoming) return a.upcoming ? -1 : 1; // future rounds first
      if (a.upcoming) return a.first.localeCompare(b.first); // soonest upcoming first
      return b.last.localeCompare(a.last); // most-recent results first
    });

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.round} className="rounded-card border border-hairline bg-card p-card">
          <header className="mb-2 border-b border-hairline pb-2">
            <h3 className="text-cardtitle text-text-primary">{g.round}</h3>
          </header>
          <ul className="divide-y divide-hairline">
            {g.matches.map((m) => (
              <li key={m.id}>
                <MatchCard match={m} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
