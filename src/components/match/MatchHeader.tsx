import Link from "next/link";
import type { Match, MatchEvent } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { LocalTime } from "@/components/primitives/LocalTime";

/**
 * Match center header (CLAUDE.md section 8): competition/round breadcrumb, both
 * teams + crests, score with live-aware status (pulsing minute for live, "HT",
 * "FT", or kickoff time for scheduled — never a minute for postponed etc.), and
 * scorers with minute under each side.
 */
export function MatchHeader({ match, events }: { match: Match; events: MatchEvent[] }) {
  const goals = events.filter((e) => e.type === "goal" || e.type === "penalty" || e.type === "own_goal");
  // A goal benefits the scorer's team, except own goals which benefit the opponent.
  const homeScorers = goals.filter((e) =>
    e.type === "own_goal" ? e.teamId === match.awayTeamId : e.teamId === match.homeTeamId,
  );
  const awayScorers = goals.filter((e) =>
    e.type === "own_goal" ? e.teamId === match.homeTeamId : e.teamId === match.awayTeamId,
  );

  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-surface-dark p-6 text-text-on-dark">
      <div className="mb-5 flex items-center justify-center gap-1.5 text-[11px] text-text-on-dark-dim">
        {match.competition && (
          <Link href={`/competition/${match.competition.slug}`} className="hover:text-text-on-dark">
            {match.competition.name}
          </Link>
        )}
        {match.round && <span>· {match.round}</span>}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <TeamCol team={match.homeTeam} />
        <ScoreCol match={match} />
        <TeamCol team={match.awayTeam} />
      </div>

      {(homeScorers.length > 0 || awayScorers.length > 0) && (
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-4 text-[11px]">
          <ScorerList events={homeScorers} align="right" />
          <ScorerList events={awayScorers} align="left" />
        </div>
      )}
    </section>
  );
}

function TeamCol({ team }: { team?: Match["homeTeam"] }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Crest src={team?.crest} name={team?.name ?? "Team"} size={56} />
      <span className="text-cardtitle font-semibold">{team?.name}</span>
    </div>
  );
}

function ScoreCol({ match }: { match: Match }) {
  if (match.status === "scheduled") {
    return (
      <div className="px-4 text-center">
        <div className="text-[11px] text-text-on-dark-dim">
          <LocalTime iso={match.kickoffUtc} mode="date" />
        </div>
        <div className="tabular text-[22px] font-bold">
          <LocalTime iso={match.kickoffUtc} mode="time" />
        </div>
      </div>
    );
  }
  const hasScore = match.homeScore != null && match.awayScore != null;
  return (
    <div className="px-4 text-center">
      <div className="tabular text-[40px] font-bold leading-none">
        {hasScore ? `${match.homeScore} - ${match.awayScore}` : "-"}
      </div>
      <div className="mt-2 flex justify-center">{statusBadge(match)}</div>
    </div>
  );
}

function statusBadge(match: Match) {
  switch (match.status) {
    case "live":
      return (
        <span className="tabular animate-live-pulse text-meta font-bold text-live-minute">
          {match.minute != null ? `${match.minute}'` : "LIVE"}
        </span>
      );
    case "ht":
      return <span className="text-meta font-bold text-live-red">HALF TIME</span>;
    case "finished":
      return <span className="text-meta font-medium text-text-on-dark-dim">FULL TIME</span>;
    case "postponed":
      return <span className="text-meta font-medium text-text-on-dark-dim">POSTPONED</span>;
    case "cancelled":
      return <span className="text-meta font-medium text-text-on-dark-dim">CANCELLED</span>;
    case "abandoned":
      return <span className="text-meta font-medium text-text-on-dark-dim">ABANDONED</span>;
    case "suspended":
      return <span className="text-meta font-medium text-text-on-dark-dim">SUSPENDED</span>;
    default:
      return null;
  }
}

function ScorerList({ events, align }: { events: MatchEvent[]; align: "left" | "right" }) {
  return (
    <ul className={`space-y-1 ${align === "right" ? "text-right" : "text-left"}`}>
      {events.map((e) => (
        <li key={e.id} className="text-text-on-dark-dim">
          <span className="text-text-on-dark">{e.playerName ?? "—"}</span> {e.minute}&rsquo;
          {e.type === "own_goal" ? " (OG)" : e.type === "penalty" ? " (P)" : ""}
        </li>
      ))}
    </ul>
  );
}
