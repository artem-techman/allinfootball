import Link from "next/link";
import type { Match } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { LocalTime } from "@/components/primitives/LocalTime";
import { ChevronRightIcon } from "@/components/primitives/icons";
import { matchWinner, hasShootout } from "@/lib/utils/match";

/**
 * Latest Results rail: the three most recently finished games across the nine
 * competitions, each with the final score (the winner emphasised) and a link to
 * the match. Sits below the Top Table in the home right rail.
 */
export function LatestResultsRail({ matches }: { matches: Match[] }) {
  if (matches.length === 0) return null;

  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-cardtitle text-text-primary">Latest Results</h3>
        <Link href="/matches" className="flex items-center gap-1 text-[12px] font-semibold text-text-secondary hover:text-text-primary">
          See all <ChevronRightIcon size={14} />
        </Link>
      </header>

      <ul className="divide-y divide-hairline">
        {matches.map((m) => {
          const winner = matchWinner(m);
          const pens = hasShootout(m);
          return (
            <li key={m.id}>
              <Link href={`/match/${m.slug}`} className="block py-2.5">
                <div className="mb-1 flex items-center gap-1.5">
                  <Crest src={m.competition?.logo} name={m.competition?.name ?? "Competition"} size={12} />
                  <span className="truncate text-[10px] text-text-muted">{m.competition?.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-text-muted">
                    <LocalTime iso={m.kickoffUtc} mode="date" />
                  </span>
                </div>
                <ResultRow name={m.homeTeam?.name ?? "Home"} crest={m.homeTeam?.crest} score={m.homeScore} pen={pens ? m.homePenalty : undefined} win={winner === "home"} />
                <ResultRow name={m.awayTeam?.name ?? "Away"} crest={m.awayTeam?.crest} score={m.awayScore} pen={pens ? m.awayPenalty : undefined} win={winner === "away"} />
                {pens && (
                  <p className="mt-0.5 text-right text-[10px] text-text-muted">
                    {winner === "home" ? m.homeTeam?.name : m.awayTeam?.name} win on penalties
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ResultRow({
  name,
  crest,
  score,
  pen,
  win,
}: {
  name: string;
  crest?: string;
  score?: number;
  pen?: number;
  win: boolean;
}) {
  const tone = win ? "text-text-primary" : "text-text-secondary";
  return (
    <div className="flex items-center gap-2 py-0.5">
      <Crest src={crest} name={name} size={16} />
      <span className={`min-w-0 flex-1 truncate text-meta ${win ? "font-semibold" : ""} ${tone}`}>{name}</span>
      {pen != null && <span className="tabular shrink-0 text-[10px] text-text-muted">({pen})</span>}
      <span className={`tabular w-4 text-right text-meta font-bold ${tone}`}>{score ?? "-"}</span>
    </div>
  );
}
