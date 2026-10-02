"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Lineup, Match, MatchEvent, MatchStats, Odds, Standing } from "@/lib/providers/types";
import { ChevronLeftIcon } from "@/components/primitives/icons";
import { MatchHeader } from "./MatchHeader";
import { EventTimeline } from "./EventTimeline";
import { CommentaryFeed } from "./CommentaryFeed";
import { LineupsView } from "./LineupsView";
import { StatsView } from "./StatsView";
import { HeadToHead } from "./HeadToHead";
import { MatchInfo } from "./MatchInfo";
import { OddsView } from "./OddsView";
import { StandingsTable } from "@/components/tables/StandingsTable";
import { ErrorBanner } from "@/components/primitives/ErrorBanner";
import { HighlightThumb } from "@/components/highlights/HighlightThumb";
import type { Highlight } from "@/lib/highlights";
import { compareProgress } from "@/lib/utils/match";

export interface MatchBundle {
  match: Match;
  events: MatchEvent[];
  lineups: Lineup[];
  stats: MatchStats[];
  h2h: Match[];
  standings: Standing[];
  odds?: Odds;
  highlight?: Highlight;
}

type TabId = "summary" | "live" | "lineups" | "stats" | "highlights" | "h2h" | "table" | "odds";

const TABS: { id: TabId; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "live", label: "Live" },
  { id: "lineups", label: "Lineups" },
  { id: "stats", label: "Stats" },
  { id: "highlights", label: "Highlights" },
  { id: "h2h", label: "Head-to-head" },
  { id: "table", label: "Table" },
  { id: "odds", label: "Odds" },
];

const IN_PLAY_POLL_MS = 30_000; // matches the server's 30s live TTL
const PRE_MATCH_POLL_MS = 60_000; // lineups land ~1h before; kickoff flips the status
const PRE_MATCH_WINDOW_MS = 90 * 60_000;
const OVERDUE_WINDOW_MS = 4 * 60 * 60_000; // "scheduled" well past kickoff = stale or delayed

/** How often to refresh this match, or null when it can't change any more. */
function pollInterval(m: Match, now = Date.now()): number | null {
  if (m.status === "live" || m.status === "ht") return IN_PLAY_POLL_MS;
  if (m.status !== "scheduled") return null;
  const toKickoff = new Date(m.kickoffUtc).getTime() - now;
  // Kickoff time has passed but we still say "scheduled": either our copy is
  // behind or the start is delayed — poll at the in-play rate until it flips.
  if (toKickoff <= 0) return -toKickoff < OVERDUE_WINDOW_MS ? IN_PLAY_POLL_MS : null;
  return toKickoff <= PRE_MATCH_WINDOW_MS ? PRE_MATCH_POLL_MS : null;
}

function defaultTab(status: Match["status"]): TabId {
  if (status === "live" || status === "ht") return "live";
  if (status === "scheduled") return "lineups";
  return "summary";
}

/**
 * Match center (CLAUDE.md section 8). Renders the header + tabbed content and,
 * while the fixture is live/ht (or about to kick off), polls /api/match for score,
 * events, lineups and stats (stops once it can't change). Every tab degrades to its own empty state.
 */
export function MatchCenter({ bundle }: { bundle: MatchBundle }) {
  const [match, setMatch] = useState(bundle.match);
  const [events, setEvents] = useState(bundle.events);
  const [lineups, setLineups] = useState(bundle.lineups);
  const [stats, setStats] = useState(bundle.stats);
  const [tab, setTab] = useState<TabId>(defaultTab(bundle.match.status));
  const [degraded, setDegraded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchRef = useRef(bundle.match);
  matchRef.current = match;
  const router = useRouter();

  // A fresh server render for this same match (router refresh) is adopted only
  // if it's at least as far along as what we're already showing.
  useEffect(() => {
    setMatch((cur) => (compareProgress(bundle.match, cur) >= 0 ? bundle.match : cur));
  }, [bundle.match]);

  // Poll while the match is in play, AND in the run-up to kickoff (lineups, the
  // flip to live). Previously only an in-play first render polled, so a page
  // first rendered as "scheduled" stayed empty until a manual reload.
  const interval = pollInterval(match);
  const polling = interval != null;

  useEffect(() => {
    if (!polling) return;
    let cancelled = false;
    async function tick() {
      // Hidden tabs don't poll (quota protection); resumes on foreground below.
      if (document.hidden) {
        if (!cancelled) timer.current = setTimeout(tick, IN_PLAY_POLL_MS);
        return;
      }
      let next = IN_PLAY_POLL_MS;
      try {
        const res = await fetch(`/api/match?id=${match.id}`, { cache: "no-store" });
        const data = (await res.json()) as Partial<MatchBundle> & { delayed?: boolean };
        if (cancelled) return;
        setDegraded(Boolean(data.delayed));
        const incoming = data.match;
        // Never step backwards: a response from a server instance whose cache is
        // a few seconds older must not rewind the clock, score or status.
        const ahead = incoming != null && compareProgress(incoming, matchRef.current) >= 0;
        if (ahead) {
          matchRef.current = incoming;
          setMatch(incoming);
          if (data.events) setEvents(data.events);
          if (data.stats) setStats(data.stats);
        }
        if (data.lineups?.length) setLineups(data.lineups);
        next = pollInterval(ahead ? incoming : matchRef.current) ?? IN_PLAY_POLL_MS;
      } catch {
        if (!cancelled) setDegraded(true); // serve last-good, flag delay
      } finally {
        if (!cancelled) timer.current = setTimeout(tick, next);
      }
    }
    function onVisibilityChange() {
      if (document.hidden || cancelled) return;
      if (timer.current) clearTimeout(timer.current);
      tick();
    }
    // Fetch straight away, then re-schedule; tick() keeps its own cadence.
    tick();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [polling, match.id]);

  const homeStats = useMemo(() => stats.find((s) => s.teamId === match.homeTeamId), [stats, match.homeTeamId]);
  const awayStats = useMemo(() => stats.find((s) => s.teamId === match.awayTeamId), [stats, match.awayTeamId]);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-meta font-semibold text-text-secondary transition-colors hover:text-text-primary"
      >
        <ChevronLeftIcon size={16} />
        Back
      </button>
      {degraded && <ErrorBanner />}
      <MatchHeader match={match} events={events} />

      {/* tab bar */}
      <div role="tablist" aria-label="Match sections" className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-hairline">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`relative whitespace-nowrap px-3.5 py-2.5 text-meta font-semibold transition-colors ${
                active ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t.label}
              {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent-gradient" />}
            </button>
          );
        })}
      </div>

      <div>
        {tab === "summary" && <EventTimeline events={events} match={match} />}
        {tab === "live" && <CommentaryFeed events={events} match={match} />}
        {tab === "lineups" && <LineupsView lineups={lineups} match={match} />}
        {tab === "stats" && <StatsView home={homeStats} away={awayStats} />}
        {tab === "highlights" && <HighlightsTab highlight={bundle.highlight} status={match.status} />}
        {tab === "h2h" && <HeadToHead fixtures={bundle.h2h} match={match} />}
        {tab === "table" && (
          <StandingsTable rows={bundle.standings} highlightTeamIds={[match.homeTeamId, match.awayTeamId]} />
        )}
        {tab === "odds" && <OddsView odds={bundle.odds} match={match} />}
      </div>

      <MatchInfo match={match} />
    </div>
  );
}

/** Post-match highlights: the official embed once available, else a clear state. */
function HighlightsTab({ highlight, status }: { highlight?: Highlight; status: Match["status"] }) {
  if (highlight) {
    return (
      <div>
        <HighlightThumb title={highlight.title} thumbnailUrl={highlight.thumbnailUrl} watchUrl={highlight.watchUrl} />
        <p className="mt-3 text-meta text-text-secondary">
          {highlight.title} · <span className="text-text-muted">{highlight.channelTitle}</span>
        </p>
      </div>
    );
  }
  const message =
    status === "finished"
      ? "Highlights for this match aren't available yet — official clips usually appear shortly after full time."
      : "Highlights become available once the match has finished.";
  return (
    <div className="rounded-card border border-dashed border-hairline px-6 py-10 text-center">
      <p className="text-meta text-text-secondary">{message}</p>
    </div>
  );
}
