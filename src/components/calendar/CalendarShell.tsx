import { AppShell } from "@/components/shell/AppShell";
import { LiveNowRail } from "@/components/rail/LiveNowRail";
import { TopTableRail } from "@/components/rail/TopTableRail";
import { MatchCalendar } from "./MatchCalendar";
import { provider } from "@/lib/providers";
import { isInScope, getCompetitionBySlug } from "@/lib/constants/competitions";
import { currentSeasonYear, pickActiveTableSlug } from "@/lib/season";
import { formatLongDate } from "@/lib/utils/date";
import type { Match, Standing } from "@/lib/providers/types";

/** The Top Table rail defaults to the Premier League, matching home. */
const TOP_TABLE_SLUG = "premier-league";

/**
 * Server shell shared by /matches and /matches/[date]. Fetches the day's
 * fixtures (scoped to the nine competitions) for SSR/indexability, then hands
 * off to the client MatchCalendar for filters + live refresh. Degrades to an
 * empty list on provider failure (CLAUDE.md section 10).
 */
export async function CalendarShell({ dateKey }: { dateKey: string }) {
  // Any date is safe to serve now: fixtures come from our competitions' cached
  // season lists (scope guard), so a crawler walking the calendar costs nothing.
  // (The old ±10-day cap made 17 Oct show "No matches" with 28 games scheduled.)
  const allMatches = await provider.getFixturesByDate(dateKey).catch(() => [] as Match[]);
  const initialMatches = allMatches.filter((m) => isInScope(m.competitionId, m.round));

  // Default the Top Table to whatever competition is being played on this date.
  const tableSlug = pickActiveTableSlug(initialMatches, TOP_TABLE_SLUG);
  const topComp = getCompetitionBySlug(tableSlug);
  const standings = topComp
    ? await currentSeasonYear(topComp)
        .then((season) => provider.getStandings(topComp.leagueId, season))
        .catch(() => [] as Standing[])
    : [];
  // Soonest scheduled fixture on this date — the Live Now rail counts down to it
  // when nothing is live.
  const nextMatch = initialMatches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))[0];

  return (
    <AppShell
      rail={
        <>
          <LiveNowRail nextMatch={nextMatch} />
          <TopTableRail initialSlug={tableSlug} initialRows={standings} />
        </>
      }
    >
      <header className="mb-6">
        <h1 className="text-greeting text-text-primary">Matches</h1>
        <p className="mt-1 text-meta text-text-secondary">{formatLongDate(dateKey)}</p>
      </header>

      <MatchCalendar dateKey={dateKey} initialMatches={initialMatches} />
    </AppShell>
  );
}
