import Link from "next/link";
import type { Match } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { EmptyState } from "@/components/primitives/EmptyState";
import { LocalTime } from "@/components/primitives/LocalTime";

/**
 * Head-to-head tab (CLAUDE.md section 8). Recent meetings between the two teams
 * with a win/draw/loss summary from the home team's perspective.
 */
export function HeadToHead({ fixtures, match }: { fixtures: Match[]; match: Match }) {
  if (fixtures.length === 0) {
    return <EmptyState title="No recent head-to-head meetings" />;
  }

  const homeId = match.homeTeamId;
  let w = 0,
    d = 0,
    l = 0;
  for (const f of fixtures) {
    if (f.homeScore == null || f.awayScore == null) continue;
    const homeIsHome = f.homeTeamId === homeId;
    const gf = homeIsHome ? f.homeScore : f.awayScore;
    const ga = homeIsHome ? f.awayScore : f.homeScore;
    if (gf > ga) w++;
    else if (gf < ga) l++;
    else d++;
  }

  return (
    <div className="rounded-card border border-hairline bg-card p-card">
      <div className="mb-3 flex items-center justify-center gap-4 text-meta">
        <span className="font-semibold text-text-primary">{match.homeTeam?.name}</span>
        <span className="tabular text-text-secondary">
          <span className="font-bold text-live-minute">{w}</span> W ·{" "}
          <span className="font-bold text-text-primary">{d}</span> D ·{" "}
          <span className="font-bold text-live-red">{l}</span> L
        </span>
      </div>
      <ul className="divide-y divide-hairline">
        {fixtures.map((f) => (
          <li key={f.id}>
            <Link href={`/match/${f.slug}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
              <span className="flex items-center justify-end gap-2 truncate text-body text-text-primary">
                <span className="truncate">{f.homeTeam?.name}</span>
                <Crest src={f.homeTeam?.crest} name={f.homeTeam?.name ?? "Home"} size={18} />
              </span>
              <span className="tabular rounded-tile bg-white/5 px-2 py-0.5 text-meta font-bold text-text-primary">
                {f.homeScore ?? "-"}–{f.awayScore ?? "-"}
              </span>
              <span className="flex items-center gap-2 truncate text-body text-text-primary">
                <Crest src={f.awayTeam?.crest} name={f.awayTeam?.name ?? "Away"} size={18} />
                <span className="truncate">{f.awayTeam?.name}</span>
              </span>
            </Link>
            <p className="pb-1 text-center text-[11px] text-text-muted">
              <LocalTime iso={f.kickoffUtc} mode="date" />
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
