import { AppShell } from "@/components/shell/AppShell";
import { LiveNowRail } from "@/components/rail/LiveNowRail";
import { TopTableRail } from "@/components/rail/TopTableRail";
import { MatchCalendar } from "./MatchCalendar";
import { provider } from "@/lib/providers";
import { isInScope, DEFAULT_COMPETITION_SLUG, getCompetitionBySlug } from "@/lib/constants/competitions";
import { formatLongDate } from "@/lib/utils/date";
import type { Match, Standing } from "@/lib/providers/types";

/**
 * Server shell shared by /matches and /matches/[date]. Fetches the day's
 * fixtures (scoped to the nine competitions) for SSR/indexability, then hands
 * off to the client MatchCalendar for filters + live refresh. Degrades to an
 * empty list on provider failure (CLAUDE.md section 10).
 */
export async function CalendarShell({ dateKey }: { dateKey: string }) {
  const pl = getCompetitionBySlug(DEFAULT_COMPETITION_SLUG);
  const [allMatches, standings] = await Promise.all([
    provider.getFixturesByDate(dateKey).catch(() => [] as Match[]),
    pl ? provider.getStandings(pl.leagueId, pl.defaultSeason).catch(() => [] as Standing[]) : Promise.resolve([]),
  ]);
  const initialMatches = allMatches.filter((m) => isInScope(m.competitionId));

  return (
    <AppShell
      rail={
        <>
          <LiveNowRail />
          <TopTableRail
            competitionName="Premier League"
            competitionSlug={DEFAULT_COMPETITION_SLUG}
            rows={standings}
          />
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
