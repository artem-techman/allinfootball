import type { Lineup, LineupPlayer, Match, MatchEvent } from "@/lib/providers/types";
import { LineupPitch } from "./LineupPitch";
import { EmptyState } from "@/components/primitives/EmptyState";
import { Crest } from "@/components/primitives/Crest";

/**
 * Lineups tab (CLAUDE.md section 8): the formation pitch (when grid data exists),
 * then each team's XI and bench as compact lists — subs show when they came on
 * and for whom, and the coach. Pending/unavailable states per section 10.
 */
export function LineupsView({ lineups, match, events = [] }: { lineups: Lineup[]; match: Match; events?: MatchEvent[] }) {
  if (lineups.length === 0) {
    // Don't promise a fixed pre-match timing we can't guarantee — the data
    // provider publishes confirmed lineups around kickoff (not reliably an hour
    // ahead), and some matches never carry lineup data at all.
    const pending = match.status === "scheduled";
    return (
      <EmptyState
        title={pending ? "Lineups not confirmed yet" : "Lineups unavailable for this match"}
        hint={pending ? "Confirmed starting XIs usually appear close to kickoff. Check back nearer the time." : undefined}
      />
    );
  }

  const home = lineups.find((l) => l.teamId === match.homeTeamId) ?? lineups[0];
  const away = lineups.find((l) => l.teamId === match.awayTeamId) ?? lineups[1];

  return (
    <div className="space-y-4">
      {home && away && <LineupPitch home={home} away={away} match={match} events={events} />}
      <div className="grid gap-4 md:grid-cols-2">
        {[home, away].filter(Boolean).map((l) => {
          const team = l!.teamId === match.homeTeamId ? match.homeTeam : match.awayTeam;
          return <TeamLineup key={l!.teamId} lineup={l!} team={team} events={events} />;
        })}
      </div>
    </div>
  );
}

function subsFor(events: MatchEvent[], teamId: number) {
  const on = new Map<number, { minute: string; off?: string }>();
  for (const e of events) {
    if (e.type !== "sub" || e.teamId !== teamId || !e.playerId) continue;
    on.set(e.playerId, { minute: `${e.minute}${e.extraMinute ? `+${e.extraMinute}` : ""}'`, off: e.relatedPlayerName });
  }
  return on;
}

function TeamLineup({ lineup, team, events }: { lineup: Lineup; team?: Match["homeTeam"]; events: MatchEvent[] }) {
  const cameOn = subsFor(events, lineup.teamId);
  const bench = [...lineup.bench].sort((a, b) => Number(cameOn.has(b.playerId)) - Number(cameOn.has(a.playerId)));
  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <header className="mb-3 flex items-center gap-2.5">
        <Crest src={team?.crest} name={team?.name ?? ""} size={22} />
        <h3 className="flex-1 truncate text-cardtitle text-text-primary">{team?.name ?? "Team"}</h3>
        {lineup.formation && (
          <span className="tabular rounded-full bg-card-2 px-2 py-0.5 text-[11px] font-semibold text-text-secondary">{lineup.formation}</span>
        )}
      </header>

      <Label>Starting XI</Label>
      <ul>
        {lineup.starters.map((p) => (
          <Row key={p.playerId} p={p} />
        ))}
      </ul>

      {bench.length > 0 && (
        <>
          <Label className="mt-4">Substitutes</Label>
          <ul>
            {bench.map((p) => {
              const sub = cameOn.get(p.playerId);
              return (
                <Row
                  key={p.playerId}
                  p={p}
                  dim={!sub}
                  extra={
                    sub ? (
                      <span className="shrink-0 text-[11px] text-text-muted">
                        <span className="font-semibold text-live-minute">↑{sub.minute}</span>
                        {sub.off ? ` for ${sub.off}` : ""}
                      </span>
                    ) : undefined
                  }
                />
              );
            })}
          </ul>
        </>
      )}

      {lineup.coachName && (
        <p className="mt-4 border-t border-hairline pt-3 text-meta text-text-secondary">
          <span className="text-text-muted">Coach</span> · {lineup.coachName}
        </p>
      )}
    </section>
  );
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted ${className}`}>{children}</p>;
}

function Row({ p, dim = false, extra }: { p: LineupPlayer; dim?: boolean; extra?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span className="tabular w-5 text-right text-[12px] font-semibold text-text-muted">{p.number ?? "–"}</span>
      <span className={`min-w-0 flex-1 truncate text-meta ${dim ? "text-text-secondary" : "text-text-primary"}`}>{p.name}</span>
      {extra}
      {p.position && <span className="w-5 shrink-0 text-center text-[11px] font-semibold text-text-muted">{p.position}</span>}
    </li>
  );
}
