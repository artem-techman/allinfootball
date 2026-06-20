import Link from "next/link";
import type { Match } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { LocalTime } from "@/components/primitives/LocalTime";
import { Countdown } from "@/components/primitives/Countdown";

/**
 * Upcoming match card (CLAUDE.md section 12): competition label + logo on top,
 * home crest+name (left), date and bold time (center), away crest+name (right).
 * White card, hairline border.
 */
export function UpcomingMatchCard({ match }: { match: Match }) {
  const home = match.homeTeam;
  const away = match.awayTeam;
  return (
    <Link
      href={`/match/${match.slug}`}
      className="flex h-full min-h-[196px] flex-col rounded-card border border-hairline bg-card p-card transition-colors duration-200 hover:border-white/15 hover:bg-card-2"
    >
      <div className="mb-4 flex items-center gap-2">
        <Crest src={match.competition?.logo} name={match.competition?.name ?? "Competition"} size={16} />
        <span className="truncate text-meta text-text-secondary">
          {match.competition?.name ?? ""}
        </span>
      </div>
      <div className="flex items-center justify-between gap-1">
        <TeamSide name={home?.name ?? "Home"} crest={home?.crest} />
        <div className="shrink-0 px-1 text-center">
          <div className="text-[10px] text-text-secondary">
            <LocalTime iso={match.kickoffUtc} mode="date" />
          </div>
          <div className="tabular text-cardtitle font-bold text-text-primary">
            <LocalTime iso={match.kickoffUtc} mode="time" />
          </div>
        </div>
        <TeamSide name={away?.name ?? "Away"} crest={away?.crest} />
      </div>
      <Countdown kickoffUtc={match.kickoffUtc} />
    </Link>
  );
}

function TeamSide({
  name,
  crest,
}: {
  name: string;
  crest?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <Crest src={crest} name={name} size={30} />
      <span className="line-clamp-2 min-h-[28px] w-full text-center text-[11px] font-semibold leading-tight text-text-primary">
        {name}
      </span>
    </div>
  );
}
