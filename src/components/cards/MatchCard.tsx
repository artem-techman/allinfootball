import Link from "next/link";
import type { Match } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { LocalTime } from "@/components/primitives/LocalTime";
import { matchWinner, hasShootout } from "@/lib/utils/match";

/**
 * Compact match row used in lists/rails. Status drives the right-hand cell:
 *  - scheduled:  date + bold time
 *  - live:       pulsing minute in live-minute green
 *  - ht:         "HT" in live-red
 *  - finished:   final score, muted
 *  - postponed/cancelled/abandoned/suspended: status word, NEVER a minute
 * (CLAUDE.md sections 9 + 10). Scores use tabular figures.
 */
export function MatchCard({ match }: { match: Match }) {
  const home = match.homeTeam;
  const away = match.awayTeam;
  const hasScore = match.homeScore != null && match.awayScore != null;
  // Emphasise the winner once finished (covers extra time / penalties); show the
  // shootout digits when a knockout tie went to penalties.
  const winner = match.status === "finished" ? matchWinner(match) : null;
  const pens = hasShootout(match);

  return (
    <Link
      href={`/match/${match.slug}`}
      className="flex items-center gap-3 rounded-tile px-2 py-2 transition-colors hover:bg-[var(--page-bg)]"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <TeamRow name={home?.name ?? "Home"} crest={home?.crest} score={match.homeScore} pen={pens ? match.homePenalty : undefined} showScore={hasScore} win={winner === "home"} dim={winner === "away"} />
        <TeamRow name={away?.name ?? "Away"} crest={away?.crest} score={match.awayScore} pen={pens ? match.awayPenalty : undefined} showScore={hasScore} win={winner === "away"} dim={winner === "home"} />
      </div>
      <div className="shrink-0 text-right">
        <StatusCell match={match} />
      </div>
    </Link>
  );
}

function TeamRow({
  name,
  crest,
  score,
  pen,
  showScore,
  win,
  dim,
}: {
  name: string;
  crest?: string;
  score?: number;
  pen?: number;
  showScore: boolean;
  win?: boolean;
  dim?: boolean;
}) {
  const tone = dim ? "text-text-secondary" : "text-text-primary";
  return (
    <div className="flex items-center gap-2">
      <Crest src={crest} name={name} size={18} />
      <span className={`min-w-0 flex-1 truncate text-body ${win ? "font-semibold" : ""} ${tone}`}>{name}</span>
      {pen != null && <span className="tabular shrink-0 text-[11px] text-text-muted">({pen})</span>}
      {showScore && (
        <span className={`tabular w-5 text-right text-body font-semibold ${tone}`}>
          {score ?? "-"}
        </span>
      )}
    </div>
  );
}

function StatusCell({ match }: { match: Match }) {
  switch (match.status) {
    case "live":
      return (
        <span className="tabular animate-live-pulse text-meta font-bold text-live-minute">
          {match.minute != null ? `${match.minute}'` : "LIVE"}
        </span>
      );
    case "ht":
      return <span className="text-meta font-bold text-live-red">HT</span>;
    case "finished":
      return <span className="text-meta font-medium text-text-secondary">FT</span>;
    case "postponed":
      return <span className="text-meta font-medium text-text-secondary">Postponed</span>;
    case "cancelled":
      return <span className="text-meta font-medium text-text-secondary">Cancelled</span>;
    case "abandoned":
      return <span className="text-meta font-medium text-text-secondary">Abandoned</span>;
    case "suspended":
      return <span className="text-meta font-medium text-text-secondary">Suspended</span>;
    case "scheduled":
    default:
      return (
        <div className="leading-tight">
          <div className="text-[11px] text-text-secondary">
            <LocalTime iso={match.kickoffUtc} mode="date" />
          </div>
          <div className="tabular text-body font-bold text-text-primary">
            <LocalTime iso={match.kickoffUtc} mode="time" />
          </div>
        </div>
      );
  }
}
