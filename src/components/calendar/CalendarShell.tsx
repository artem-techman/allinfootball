import { AppShell } from "@/components/shell/AppShell";
import { LiveNowRail } from "@/components/rail/LiveNowRail";
import { TopTableRail } from "@/components/rail/TopTableRail";
import { MatchCalendar } from "./MatchCalendar";
import { provider } from "@/lib/providers";
import { isInScope, DEFAULT_COMPETITION_SLUG, getCompetitionBySlug } from "@/lib/constants/competitions";
import { formatLongDate, todayKey, shiftDateKey } from "@/lib/utils/date";
import type { Match, Standing } from "@/lib/providers/types";

/** How far from today we server-fetch fixtures. Beyond this we skip the provider
 *  call so the calendar's prev/next links can't be crawled into an unbounded
 *  number of unique API requests. Real users navigating further still get data
 *  via the client's /api/fixtures refresh. */
const FETCH_WINDOW_DAYS = 10;

/**
 * Server shell shared by /matches and /matches/[date]. Fetches the day's
 * fixtures (scoped to the nine competitions) for SSR/indexability, then hands
 * off to the client MatchCalendar for filters + live refresh. Degrades to an
 * empty list on provider failure (CLAUDE.md section 10).
 */
export async function CalendarShell({ dateKey }: { dateKey: string }) {
  const pl = getCompetitionBySlug(DEFAULT_COMPETITION_SLUG);
  const today = todayKey();
  const inWindow =
    dateKey >= shiftDateKey(today, -FETCH_WINDOW_DAYS) && dateKey <= shiftDateKey(today, FETCH_WINDOW_DAYS);
  const [allMatches, standings] = await Promise.all([
    inWindow ? provider.getFixturesByDate(dateKey).catch(() => [] as Match[]) : Promise.resolve([] as Match[]),
    pl ? provider.getStandings(pl.leagueId, pl.defaultSeason).catch(() => [] as Standing[]) : Promise.resolve([]),
  ]);
  const initialMatches = allMatches.filter((m) => isInScope(m.competitionId));

  return (
    <AppShell
      rail={
        <>
          <LiveNowRail />
          <TopTableRail initialSlug={DEFAULT_COMPETITION_SLUG} initialRows={standings} />
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
