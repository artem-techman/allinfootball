"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Match } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { TrophyIcon, ChevronRightIcon } from "@/components/primitives/icons";

export interface BracketRound {
  name: string;
  matches: Match[];
}

const ABBR: Record<string, string> = {
  "Round of 32": "R32",
  "Round of 16": "R16",
  "Quarter-finals": "QF",
  "Semi-finals": "SF",
  Final: "Final",
};

/**
 * World Cup knockout bracket. Each round's matches are split in half: the first
 * half flows in from the left, the second from the right, and they converge on
 * the Final in the centre. Columns use justify-around so each match sits centred
 * between its two feeders (the bracket "tree" shape). Scrolls horizontally on
 * narrow screens.
 */
export function WorldCupBracket({ rounds }: { rounds: BracketRound[] }) {
  // The scroller: when the tree is wider than the card, centre the scroll on the
  // Final (so it reads as symmetric and both halves are reachable); when it fits,
  // centre it with flexbox instead. `fits` starts false so the SSR markup is
  // start-aligned (never clipped) before the effect measures.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const overflow = el.scrollWidth > el.clientWidth + 1;
      setFits(!overflow);
      if (overflow) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rounds]);

  if (rounds.length === 0) return null;

  const finalMatch = rounds.find((r) => r.name === "Final")?.matches[0];
  const nonFinal = rounds.filter((r) => r.name !== "Final");
  const half = (m: Match[]) => Math.ceil(m.length / 2);
  const leftCols = nonFinal.map((r) => ({ name: r.name, matches: r.matches.slice(0, half(r.matches)) }));
  const rightCols = [...nonFinal].reverse().map((r) => ({ name: r.name, matches: r.matches.slice(half(r.matches)) }));

  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-section text-text-primary">World Cup Knockouts</h2>
          <p className="mt-0.5 text-meta text-text-secondary">The road to the final.</p>
        </div>
        <Link
          href="/competition/world-cup/fixtures"
          className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-text-secondary hover:text-text-primary"
        >
          Full schedule <ChevronRightIcon size={14} />
        </Link>
      </header>

      {/* The flex container is itself the horizontal scroller. Columns are
          shrink-0 to keep their width; the effect above centres the scroll on
          the Final when the tree overflows, and we centre with flexbox when it
          fits. Either way the left columns are never clipped/stranded. */}
      <div
        ref={scrollRef}
        className={`flex items-stretch gap-2 overflow-x-auto pb-1 sm:gap-3 ${fits ? "justify-center" : "justify-start"}`}
      >
        {leftCols.map((c) => (
          <Column key={`L-${c.name}`} name={c.name} matches={c.matches} align="left" />
        ))}
        <FinalColumn match={finalMatch} />
        {rightCols.map((c) => (
          <Column key={`R-${c.name}`} name={c.name} matches={c.matches} align="right" />
        ))}
      </div>
    </section>
  );
}

function Column({ name, matches, align }: { name: string; matches: Match[]; align: "left" | "right" }) {
  return (
    <div className="flex w-[104px] shrink-0 flex-col">
      <div
        className={`mb-2 text-[10px] font-bold uppercase tracking-wide text-text-muted ${
          align === "left" ? "text-left" : "text-right"
        }`}
      >
        {ABBR[name] ?? name}
      </div>
      <div className="flex flex-1 flex-col justify-around gap-2">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  return (
    <Link href={`/match/${match.slug}`} className="block rounded-tile border border-hairline bg-card-2 p-1.5 transition-colors hover:border-white/15">
      <TeamLine match={match} side="home" />
      <div className="my-1 h-px bg-hairline" />
      <TeamLine match={match} side="away" />
    </Link>
  );
}

function FinalColumn({ match }: { match?: Match }) {
  return (
    <div className="flex w-[140px] shrink-0 flex-col items-center justify-center px-1">
      <div className="mb-2 flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide text-text-primary">
        <TrophyIcon size={13} /> Final
      </div>
      <div className="w-full rounded-tile bg-accent-gradient p-[2px] shadow-elevated">
        <div className="rounded-[10px] bg-card-2 p-2">
          {match ? (
            <Link href={`/match/${match.slug}`} className="block">
              <TeamLine match={match} side="home" />
              <div className="my-1 h-px bg-hairline" />
              <TeamLine match={match} side="away" />
            </Link>
          ) : (
            <p className="py-2 text-center text-[11px] text-text-secondary">To be decided</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamLine({ match, side }: { match: Match; side: "home" | "away" }) {
  const team = side === "home" ? match.homeTeam : match.awayTeam;
  const score = side === "home" ? match.homeScore : match.awayScore;
  const other = side === "home" ? match.awayScore : match.homeScore;
  const played = score != null && other != null;
  const win = played && score > other;
  return (
    <div className="flex items-center gap-1.5">
      <Crest src={team?.crest} name={team?.name ?? "TBD"} size={14} />
      <span className={`min-w-0 flex-1 truncate text-[11px] ${win ? "font-bold text-text-primary" : "text-text-secondary"}`}>
        {team?.name ?? "TBD"}
      </span>
      <span className={`tabular w-3 shrink-0 text-right text-[11px] ${win ? "font-bold text-text-primary" : "text-text-secondary"}`}>
        {score ?? ""}
      </span>
    </div>
  );
}
