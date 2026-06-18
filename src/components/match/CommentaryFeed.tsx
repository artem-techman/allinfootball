import type { Match, MatchEvent } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { EmptyState } from "@/components/primitives/EmptyState";

/**
 * Live tab — minute-by-minute feed (CLAUDE.md section 8). API-Football does not
 * provide text commentary, so we synthesise a reverse-chronological feed from
 * match events. Pre-match shows a waiting state.
 */
function sentence(e: MatchEvent, teamName: string): string {
  const who = e.playerName ?? "";
  switch (e.type) {
    case "goal":
      return `GOAL! ${who} scores for ${teamName}.${e.relatedPlayerName ? ` Assisted by ${e.relatedPlayerName}.` : ""}`;
    case "penalty":
      return `GOAL! ${who} converts the penalty for ${teamName}.`;
    case "own_goal":
      return `Own goal — ${who} turns it into his own net (${teamName}).`;
    case "missed_penalty":
      return `Penalty missed by ${who} (${teamName}).`;
    case "yellow":
      return `Yellow card shown to ${who} (${teamName}).`;
    case "red":
      return `Red card! ${who} is sent off (${teamName}).`;
    case "sub":
      return `Substitution for ${teamName}: ${who} on${e.relatedPlayerName ? `, ${e.relatedPlayerName} off` : ""}.`;
    case "var":
      return `VAR check — ${e.detail ?? "review"} (${teamName}).`;
    default:
      return `${who} (${teamName}).`;
  }
}

export function CommentaryFeed({ events, match }: { events: MatchEvent[]; match: Match }) {
  if (events.length === 0) {
    const live = match.status === "live" || match.status === "ht";
    return (
      <EmptyState
        title={live ? "Awaiting the first update" : "Commentary starts at kickoff"}
        hint={live ? undefined : "Check back when the match is underway."}
      />
    );
  }

  const feed = [...events].sort(
    (a, b) => b.minute + (b.extraMinute ?? 0) / 100 - (a.minute + (a.extraMinute ?? 0) / 100),
  );

  return (
    <div className="rounded-card border border-hairline bg-card p-card">
      <ul className="space-y-3">
        {feed.map((e) => {
          const team = e.teamId === match.homeTeamId ? match.homeTeam : match.awayTeam;
          return (
            <li key={e.id} className="flex gap-3">
              <span className="tabular w-9 shrink-0 text-right text-meta font-bold text-text-secondary">
                {e.minute}&rsquo;{e.extraMinute ? `+${e.extraMinute}` : ""}
              </span>
              <span className="mt-0.5 shrink-0">
                <Crest src={team?.crest} name={team?.name ?? "Team"} size={16} />
              </span>
              <p className="text-body text-text-primary">{sentence(e, team?.name ?? "")}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
