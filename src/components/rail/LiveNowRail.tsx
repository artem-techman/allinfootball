"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Match } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { Pill } from "@/components/primitives/Pill";
import { Skeleton } from "@/components/primitives/Skeleton";
import { ErrorBanner } from "@/components/primitives/ErrorBanner";
import { Countdown } from "@/components/primitives/Countdown";
import { ChevronRightIcon } from "@/components/primitives/icons";

const LIVE_POLL_MS = 15_000; // while a match is live
const NEAR_KICKOFF_POLL_MS = 20_000; // around the next kickoff, to catch it going live
const IDLE_POLL_MS = 5 * 60_000; // nothing live and the next match is a while away
const NEAR_KICKOFF_WINDOW_MS = 2 * 60_000; // "around kickoff" threshold

/**
 * Live Now rail. While matches are in play it lists them (team rows + score +
 * minute, refreshing every 15s). When NOTHING is live it shows the next upcoming
 * fixture (`nextMatch`) with a live "Starts in" countdown, and polls faster as
 * kickoff approaches so it flips to the live view automatically once it starts.
 *
 * `previewMatches` still renders sample live fixtures in the keyless demo.
 */
export function LiveNowRail({
  previewMatches = [],
  nextMatch,
}: {
  previewMatches?: Match[];
  nextMatch?: Match;
}) {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [degraded, setDegraded] = useState(false);
  // a goal-event key (timestamp) that triggers the widget-wide celebration; null when idle
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevScores = useRef<Map<number, { home: number; away: number }>>(new Map());
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    /**
     * Compare each live match's score to the previous poll; if ANY side scored,
     * trigger the widget-wide goal celebration (the first poll just records a
     * baseline so existing scores don't celebrate on load).
     */
    function detectGoals(incoming: Match[]) {
      const liveNow = incoming.filter((m) => m.status === "live" || m.status === "ht");
      const next = new Map<number, { home: number; away: number }>();
      let scored = false;
      for (const m of liveNow) {
        const h = m.homeScore ?? 0;
        const a = m.awayScore ?? 0;
        const prev = prevScores.current.get(m.id);
        if (prev && (h > prev.home || a > prev.away)) scored = true;
        next.set(m.id, { home: h, away: a });
      }
      prevScores.current = next; // also prunes matches that are no longer live
      if (!scored) return;
      setCelebrate(Date.now());
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
      celebrateTimer.current = setTimeout(() => setCelebrate(null), 1800);
    }

    function scheduleNext(anyLive: boolean) {
      let delay = IDLE_POLL_MS;
      if (anyLive) {
        delay = LIVE_POLL_MS;
      } else if (nextMatch) {
        const ms = new Date(nextMatch.kickoffUtc).getTime() - Date.now();
        delay = ms <= NEAR_KICKOFF_WINDOW_MS ? NEAR_KICKOFF_POLL_MS : IDLE_POLL_MS;
      }
      timer.current = setTimeout(tick, delay);
    }

    async function tick() {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { matches: Match[]; delayed?: boolean; reason?: string };
        if (cancelled) return;
        setDegraded(Boolean(data.delayed) && data.reason !== "no_key");
        if (data.reason === "no_key" && previewMatches.length) {
          setMatches(previewMatches);
          setIsPreview(true);
        } else {
          setMatches(data.matches);
          setIsPreview(false);
        }
        detectGoals(data.matches ?? []);
        const anyLive = (data.matches ?? []).some((m) => m.status === "live" || m.status === "ht");
        scheduleNext(anyLive);
      } catch {
        if (cancelled) return;
        setDegraded(true);
        setMatches((prev) => prev ?? []); // keep last-good real data; never fake it
        setIsPreview(false);
        scheduleNext(false);
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
    };
  }, [previewMatches, nextMatch]);

  const live = (matches ?? []).filter((m) => m.status === "live" || m.status === "ht");
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
                  <LiveStatus minute={m.minute} status={m.status} />
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

function LiveStatus({ minute, status }: { minute?: number; status: Match["status"] }) {
  if (status === "ht") return <span className="shrink-0 text-meta font-bold text-live-red">HT</span>;
  if (status === "live")
    return (
      <span className="tabular shrink-0 text-meta font-bold text-live-minute">
        {minute != null ? `${minute}'` : "LIVE"}
      </span>
    );
  return <span className="shrink-0 text-meta text-text-secondary">FT</span>;
}
