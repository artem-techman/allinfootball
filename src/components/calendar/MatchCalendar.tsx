"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Match } from "@/lib/providers/types";
import { COMPETITIONS, isInScope } from "@/lib/constants/competitions";
import { loadProfile } from "@/lib/profile";
import { MatchCard } from "@/components/cards/MatchCard";
import { Crest } from "@/components/primitives/Crest";
import { EmptyState } from "@/components/primitives/EmptyState";
import { ErrorBanner } from "@/components/primitives/ErrorBanner";
import { DateStrip } from "./DateStrip";
import { FilterTabs, type CalendarFilter } from "./FilterTabs";

/** Order index so groups render with Premier League first (CLAUDE.md section 8). */
const ORDER = new Map(COMPETITIONS.map((c, i) => [c.leagueId, i]));

/**
 * Match calendar (CLAUDE.md section 8): date strip + filter tabs, fixtures
 * grouped by competition (Premier League first), and auto-refresh while any
 * match is live. SSR provides the first paint via `initialMatches`; the client
 * polls /api/fixtures for live updates. Scoped to the nine competitions.
 */
export function MatchCalendar({
  dateKey,
  initialMatches,
}: {
  dateKey: string;
  initialMatches: Match[];
}) {
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [delayed, setDelayed] = useState(false);
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const [favTeamIds, setFavTeamIds] = useState<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const p = loadProfile();
    setFavTeamIds([...p.followingTeamIds, ...p.favoriteTeamIds]);
  }, []);

  // Re-sync when the date changes (SSR passes fresh initialMatches per route).
  useEffect(() => {
    setMatches(initialMatches);
  }, [initialMatches, dateKey]);

  // Poll for live updates while any fixture on this date is in play.
  useEffect(() => {
    let cancelled = false;
    const anyLive = matches.some((m) => m.status === "live" || m.status === "ht");
    if (!anyLive) return;

    async function tick() {
      try {
        const res = await fetch(`/api/fixtures?date=${dateKey}`, { cache: "no-store" });
        const data = (await res.json()) as { matches: Match[]; delayed?: boolean };
        if (cancelled) return;
        if (data.matches?.length) setMatches(data.matches);
        setDelayed(Boolean(data.delayed));
      } catch {
        if (!cancelled) setDelayed(true);
      } finally {
        if (!cancelled) timer.current = setTimeout(tick, 20_000);
      }
    }
    timer.current = setTimeout(tick, 20_000);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dateKey, matches]);

  const inScope = useMemo(() => matches.filter((m) => isInScope(m.competitionId)), [matches]);
  const liveCount = useMemo(
    () => inScope.filter((m) => m.status === "live" || m.status === "ht").length,
    [inScope],
  );

  const filtered = useMemo(() => {
    switch (filter) {
      case "live":
        return inScope.filter((m) => m.status === "live" || m.status === "ht");
      case "finished":
        return inScope.filter((m) => m.status === "finished");
      case "favorites":
        return inScope.filter(
          (m) => favTeamIds.includes(m.homeTeamId) || favTeamIds.includes(m.awayTeamId),
        );
      default:
        return inScope;
    }
  }, [inScope, filter, favTeamIds]);

  const groups = useMemo(() => {
    const byComp = new Map<number, Match[]>();
    for (const m of filtered) {
      const arr = byComp.get(m.competitionId) ?? [];
      arr.push(m);
      byComp.set(m.competitionId, arr);
    }
    return [...byComp.entries()]
      .sort((a, b) => (ORDER.get(a[0]) ?? 99) - (ORDER.get(b[0]) ?? 99))
      .map(([leagueId, ms]) => ({
        leagueId,
        competition: ms[0].competition,
        matches: ms.sort((x, y) => x.kickoffUtc.localeCompare(y.kickoffUtc)),
      }));
  }, [filtered]);

  return (
    <div className="space-y-5">
      <DateStrip selected={dateKey} />

      <div className="flex items-center justify-between gap-3">
        <FilterTabs value={filter} onChange={setFilter} liveCount={liveCount} />
        {delayed && <ErrorBanner />}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title={emptyTitle(filter)}
          hint={filter === "favorites" ? "Follow teams to see their matches here." : undefined}
        />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.leagueId} className="rounded-card border border-hairline bg-card p-card">
              <header className="mb-2 flex items-center gap-2 border-b border-hairline pb-2">
                <Crest src={g.competition?.logo} name={g.competition?.name ?? "Competition"} size={18} />
                <h3 className="text-cardtitle text-text-primary">{g.competition?.name}</h3>
                <span className="text-meta text-text-muted">{g.matches.length}</span>
              </header>
              <ul className="divide-y divide-hairline">
                {g.matches.map((m) => (
                  <li key={m.id}>
                    <MatchCard match={m} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function emptyTitle(filter: CalendarFilter): string {
  switch (filter) {
    case "live":
      return "No live matches in your competitions right now";
    case "finished":
      return "No finished matches on this day";
    case "favorites":
      return "No matches for your teams on this day";
    default:
      return "No matches in your competitions on this day";
  }
}
