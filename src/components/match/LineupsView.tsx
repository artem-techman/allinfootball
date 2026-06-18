import type { Lineup, Match } from "@/lib/providers/types";
import { FormationPitch } from "./FormationPitch";
import { EmptyState } from "@/components/primitives/EmptyState";

/**
 * Lineups tab (CLAUDE.md section 8): FormationPitch (when grid data exists) plus
 * a list view, bench and coach for each team. Shows the pending state when no
 * lineup is posted yet (section 10).
 */
export function LineupsView({ lineups, match }: { lineups: Lineup[]; match: Match }) {
  if (lineups.length === 0) {
    return <EmptyState title="Lineups confirmed about 1 hour before kickoff" />;
  }

  const home = lineups.find((l) => l.teamId === match.homeTeamId) ?? lineups[0];
  const away = lineups.find((l) => l.teamId === match.awayTeamId) ?? lineups[1];

  return (
    <div className="space-y-4">
      {home && away && (
        <FormationPitch home={home} away={away} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {[home, away].filter(Boolean).map((l) => (
          <TeamLineup
            key={l!.teamId}
            lineup={l!}
            teamName={(l!.teamId === match.homeTeamId ? match.homeTeam : match.awayTeam)?.name ?? "Team"}
          />
        ))}
      </div>
    </div>
  );
}

function TeamLineup({ lineup, teamName }: { lineup: Lineup; teamName: string }) {
  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-cardtitle text-text-primary">{teamName}</h3>
        {lineup.formation && (
          <span className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
            {lineup.formation}
          </span>
        )}
      </header>

      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Starting XI</p>
      <ul className="divide-y divide-hairline">
        {lineup.starters.map((p) => (
          <li key={p.playerId} className="flex items-center gap-3 py-1.5 text-body">
            <span className="tabular w-6 text-center text-meta text-text-muted">{p.number ?? "-"}</span>
            <span className="flex-1 truncate text-text-primary">{p.name}</span>
            {p.position && <span className="text-[11px] text-text-muted">{p.position}</span>}
          </li>
        ))}
      </ul>

      {lineup.bench.length > 0 && (
        <>
          <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Bench</p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-meta text-text-secondary">
            {lineup.bench.map((p) => (
              <li key={p.playerId}>
                <span className="tabular text-text-muted">{p.number ?? "-"}</span> {p.name}
              </li>
            ))}
          </ul>
        </>
      )}

      {lineup.coachName && (
        <p className="mt-3 text-meta text-text-secondary">
          <span className="text-text-muted">Coach:</span> {lineup.coachName}
        </p>
      )}
    </section>
  );
}
