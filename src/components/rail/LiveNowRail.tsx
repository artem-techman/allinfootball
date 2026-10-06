"use client";

import Link from "next/link";
import type { Match } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { Pill } from "@/components/primitives/Pill";
import { Skeleton } from "@/components/primitives/Skeleton";
import { ErrorBanner } from "@/components/primitives/ErrorBanner";
import { Countdown } from "@/components/primitives/Countdown";
import { ChevronRightIcon } from "@/components/primitives/icons";
import { useLiveFeed } from "./liveFeed";
import { LiveMinute } from "@/components/primitives/LiveMinute";

/** Stable default: a fresh `[]` per render once re-ran the polling effect on
 *  every render — a tight fetch loop. Polling now lives in useLiveFeed. */
const NO_PREVIEW: Match[] = [];

const isInPlay = (m: Match) => m.status === "live" || m.status === "ht";

/**
 * Live Now rail. While matches are in play it lists them (score + ticking
 * minute); when nothing is live it shows the next fixture (`nextMatch`) with a
 * "Starts in" countdown. All mounted rails share ONE poll of /api/live
 * (useLiveFeed) — home mounts two (desktop rail + mobile column).
 *
 * `previewMatches` still renders sample live fixtures in the keyless demo.
 */
export function LiveNowRail({
  previewMatches = NO_PREVIEW,
  nextMatch,
}: {
  previewMatches?: Match[];
  nextMatch?: Match;
}) {
  const feed = useLiveFeed(nextMatch?.kickoffUtc);
  // Pages without their own fixture list (news, transfers) use the server's.
  nextMatch = nextMatch ?? feed.next ?? undefined;
  const isPreview = feed.noKey && previewMatches.length > 0;
  const matches = isPreview ? previewMatches : feed.matches;
  const degraded = feed.degraded;
  const celebrate = feed.celebrate;

  const live = (matches ?? []).filter(isInPlay);
  const hasLive = live.length > 0;

  const card = (
    <section
      className={`relative overflow-hidden bg-card p-card ${
        hasLive ? "rounded-[15px]" : "rounded-card border border-hairline"
      } ${celebrate != null ? "animate-goal-react" : ""}`}
    >
      {celebrate != null && <GoalCelebration key={celebrate} />}
      <header className="mb-1 flex items-center justify-between">
        <h3 className="text-cardtitle text-text-primary">Live Now</h3>
        {hasLive ? (
          <Pill tone="lime">
            <span className="mr-1 inline-block h-1.5 w-1.5 animate-live-pulse rounded-full bg-current" />
            Live
          </Pill>
        ) : (
          (matches !== null && nextMatch) && (
            <span className="rounded-full bg-card-2 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-text-secondary">
              Up next
            </span>
          )
        )}
      </header>

      {degraded && (
        <div className="mb-2">
          <ErrorBanner />
        </div>
      )}

      <div aria-live="polite" aria-atomic="false">
        {matches === null ? (
          <div className="space-y-3 pt-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : hasLive ? (
          <ul className="divide-y divide-hairline">
            {live.map((m) => (
              <li key={m.id}>
                <Link href={`/match/${m.slug}`} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Crest src={m.competition?.logo} name={m.competition?.name ?? "Competition"} size={13} />
                      <span className="truncate text-[11px] text-text-muted">{m.competition?.name}</span>
                    </div>
                    <Row name={m.homeTeam?.name ?? "Home"} crest={m.homeTeam?.crest} score={m.homeScore} />
                    <Row name={m.awayTeam?.name ?? "Away"} crest={m.awayTeam?.crest} score={m.awayScore} />
                  </div>
                  <LiveStatus match={m} />
                </Link>
              </li>
            ))}
          </ul>
        ) : nextMatch ? (
          <Link href={`/match/${nextMatch.slug}`} className="block pt-1">
            <div className="mb-2 flex items-center gap-1.5">
              <Crest src={nextMatch.competition?.logo} name={nextMatch.competition?.name ?? "Competition"} size={13} />
              <span className="truncate text-[11px] text-text-muted">{nextMatch.competition?.name}</span>
            </div>
            <Row name={nextMatch.homeTeam?.name ?? "Home"} crest={nextMatch.homeTeam?.crest} hideScore />
            <Row name={nextMatch.awayTeam?.name ?? "Away"} crest={nextMatch.awayTeam?.crest} hideScore />
            <Countdown kickoffUtc={nextMatch.kickoffUtc} />
          </Link>
        ) : (
          <p className="py-5 text-center text-meta text-text-secondary">No live matches right now</p>
        )}
      </div>

      <Link
        href="/matches/today"
        className="mt-2 flex items-center justify-center gap-1 border-t border-hairline pt-3 text-meta font-semibold text-text-primary hover:text-accent-lime"
      >
        View all matches <ChevronRightIcon size={15} />
      </Link>
      {isPreview && <span className="sr-only">Showing sample data</span>}
    </section>
  );

  // While a match is live, frame the widget in the same brand gradient border as
  // the World Cup Knockouts widget.
  if (hasLive) {
    return <div className="mft-gradient-border rounded-card p-[1.5px] shadow-soft">{card}</div>;
  }
  return card;
}

function Row({
  name,
  crest,
  score,
  hideScore,
}: {
  name: string;
  crest?: string;
  score?: number;
  hideScore?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <Crest src={crest} name={name} size={18} />
      <span className="min-w-0 flex-1 truncate text-meta text-text-primary">{name}</span>
      {!hideScore && (
        <span className="tabular w-4 text-right text-meta font-bold text-text-primary">{score ?? "-"}</span>
      )}
    </div>
  );
}

/** Goal celebration: a burst of footballs raining down the whole widget. Keyed by
 *  the goal event in the parent so it remounts (and replays) on every goal. */
const FALL_BALLS = [6, 17, 28, 39, 50, 61, 72, 83, 94, 22, 56, 78];

function GoalCelebration() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {FALL_BALLS.map((left, i) => (
        <span
          key={i}
          className="absolute animate-football-fall select-none leading-none"
          style={{
            left: `${left}%`,
            fontSize: `${13 + ((i * 7) % 10)}px`,
            animationDelay: `${(i % 6) * 80}ms`,
            animationDuration: `${1050 + ((i * 13) % 5) * 160}ms`,
          }}
        >
          ⚽
        </span>
      ))}
    </div>
  );
}

function LiveStatus({ match }: { match: Match }) {
  if (match.status === "ht") return <span className="shrink-0 text-meta font-bold text-live-red">HT</span>;
  if (match.status === "live")
    return <LiveMinute match={match} className="tabular shrink-0 text-meta font-bold text-live-minute" />;
  return <span className="shrink-0 text-meta text-text-secondary">FT</span>;
}
