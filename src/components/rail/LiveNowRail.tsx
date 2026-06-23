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
  // matchId -> which side just scored (+ a key to replay the animation each goal)
  const [goals, setGoals] = useState<Record<number, { side: "home" | "away"; key: number }>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevScores = useRef<Map<number, { home: number; away: number }>>(new Map());
  const goalTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    let cancelled = false;

    /**
     * Compare each live match's score to the previous poll and flag a goal when a
     * side's score increases (the very first poll just records a baseline so we
     * don't animate scores that were already on the board). The flag clears after
     * the animation so the next goal can replay it.
     */
    function detectGoals(incoming: Match[]) {
      const liveNow = incoming.filter((m) => m.status === "live" || m.status === "ht");
      const next = new Map<number, { home: number; away: number }>();
      const scored: Record<number, { side: "home" | "away"; key: number }> = {};
      for (const m of liveNow) {
        const h = m.homeScore ?? 0;
        const a = m.awayScore ?? 0;
        const prev = prevScores.current.get(m.id);
        if (prev) {
          if (h > prev.home) scored[m.id] = { side: "home", key: Date.now() };
          else if (a > prev.away) scored[m.id] = { side: "away", key: Date.now() };
        }
        next.set(m.id, { home: h, away: a });
      }
      prevScores.current = next; // also prunes matches that are no longer live
      const ids = Object.keys(scored);
      if (ids.length === 0) return;
      setGoals((prev) => ({ ...prev, ...scored }));
      for (const id of ids) {
        const mid = Number(id);
        const existing = goalTimers.current.get(mid);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
          goalTimers.current.delete(mid);
          setGoals((prev) => {
            const n = { ...prev };
            delete n[mid];
            return n;
          });
        }, 2800);
        goalTimers.current.set(mid, t);
      }
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
    const timers = goalTimers.current;
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, [previewMatches, nextMatch]);

  const live = (matches ?? []).filter((m) => m.status === "live" || m.status === "ht");
  const hasLive = live.length > 0;

  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <header className="mb-1 flex items-center justify-between">
        <h3 className="text-cardtitle text-text-primary">Live Now</h3>
        {hasLive ? (
          <Pill tone="live">
            <span className="mr-1 inline-block h-1.5 w-1.5 animate-live-pulse rounded-full bg-text-on-dark" />
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
            {live.map((m) => {
              const goal = goals[m.id];
              return (
                <li key={m.id} className="relative">
                  {goal && (
                    <span
                      key={goal.key}
                      className="pointer-events-none absolute right-0 top-1.5 z-10 animate-goal-badge rounded-full bg-accent-gradient px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-text-on-accent shadow-elevated"
                    >
                      ⚽ Goal!
                    </span>
                  )}
                  <Link
                    href={`/match/${m.slug}`}
                    className={`flex items-center gap-3 rounded-tile px-1 py-3 ${goal ? "animate-goal-flash" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <Crest src={m.competition?.logo} name={m.competition?.name ?? "Competition"} size={13} />
                        <span className="truncate text-[11px] text-text-muted">{m.competition?.name}</span>
                      </div>
                      <Row
                        name={m.homeTeam?.name ?? "Home"}
                        crest={m.homeTeam?.crest}
                        score={m.homeScore}
                        scored={goal?.side === "home" ? goal.key : undefined}
                      />
                      <Row
                        name={m.awayTeam?.name ?? "Away"}
                        crest={m.awayTeam?.crest}
                        score={m.awayScore}
                        scored={goal?.side === "away" ? goal.key : undefined}
                      />
                    </div>
                    <LiveStatus minute={m.minute} status={m.status} />
                  </Link>
                </li>
              );
            })}
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
}

function Row({
  name,
  crest,
  score,
  hideScore,
  scored,
}: {
  name: string;
  crest?: string;
  score?: number;
  hideScore?: boolean;
  /** the goal-event key when THIS side just scored — replays the pop each goal */
  scored?: number;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <Crest src={crest} name={name} size={18} />
      <span className="min-w-0 flex-1 truncate text-meta text-text-primary">{name}</span>
      {!hideScore && (
        <span
          key={scored ?? "static"}
          className={`tabular inline-block w-4 origin-center text-right text-meta font-bold text-text-primary ${
            scored ? "animate-goal-pop" : ""
          }`}
        >
          {score ?? "-"}
        </span>
      )}
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
