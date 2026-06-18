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

  const groups = [...byRound.entries()]
    .map(([round, ms]) => ({
      round,
      matches: ms.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc)),
      first: ms.reduce((min, m) => (m.kickoffUtc < min ? m.kickoffUtc : min), ms[0].kickoffUtc),
    }))
    .sort((a, b) => a.first.localeCompare(b.first));

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
