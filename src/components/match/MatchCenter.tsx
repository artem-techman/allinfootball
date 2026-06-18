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

export interface MatchBundle {
  match: Match;
  events: MatchEvent[];
  lineups: Lineup[];
  stats: MatchStats[];
  h2h: Match[];
  standings: Standing[];
  odds?: Odds;
}

type TabId = "summary" | "live" | "lineups" | "stats" | "h2h" | "table" | "odds";

const TABS: { id: TabId; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "live", label: "Live" },
  { id: "lineups", label: "Lineups" },
  { id: "stats", label: "Stats" },
  { id: "h2h", label: "Head-to-head" },
  { id: "table", label: "Table" },
  { id: "odds", label: "Odds" },
];

function defaultTab(status: Match["status"]): TabId {
  if (status === "live" || status === "ht") return "live";
  if (status === "scheduled") return "lineups";
  return "summary";
}

/**
 * Match center (CLAUDE.md section 8). Renders the header + tabbed content and,
 * while the fixture is live/ht, polls /api/match for score, events and stats
 * every 15s (stops when not in play). Every tab degrades to its own empty state.
 */
export function MatchCenter({ bundle }: { bundle: MatchBundle }) {
  const [match, setMatch] = useState(bundle.match);
  const [events, setEvents] = useState(bundle.events);
  const [lineups, setLineups] = useState(bundle.lineups);
  const [stats, setStats] = useState(bundle.stats);
  const [tab, setTab] = useState<TabId>(defaultTab(bundle.match.status));
  const [degraded, setDegraded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const inPlay = match.status === "live" || match.status === "ht";

  useEffect(() => {
    if (!inPlay) return;
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch(`/api/match?id=${match.id}`, { cache: "no-store" });
        const data = (await res.json()) as Partial<MatchBundle> & { delayed?: boolean };
        if (cancelled) return;
        setDegraded(Boolean(data.delayed));
        if (data.match) setMatch(data.match);
        if (data.events) setEvents(data.events);
        if (data.lineups?.length) setLineups(data.lineups);
        if (data.stats) setStats(data.stats);
      } catch {
        if (!cancelled) setDegraded(true); // serve last-good, flag delay
      } finally {
        if (!cancelled) timer.current = setTimeout(tick, 15_000);
      }
    }
    timer.current = setTimeout(tick, 15_000);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [inPlay, match.id]);

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
      <div role="tablist" aria-label="Match sections" className="flex gap-1 overflow-x-auto border-b border-hairline">
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
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent-lime" />}
            </button>
          );
        })}
      </div>

      <div>
        {tab === "summary" && <EventTimeline events={events} match={match} />}
        {tab === "live" && <CommentaryFeed events={events} match={match} />}
        {tab === "lineups" && <LineupsView lineups={lineups} match={match} />}
        {tab === "stats" && <StatsView home={homeStats} away={awayStats} />}
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
