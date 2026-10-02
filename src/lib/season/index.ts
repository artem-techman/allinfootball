import "server-only";
import { getCompetitionByLeagueId, type CompetitionConst } from "@/lib/constants/competitions";
import { todayKey } from "@/lib/utils/date";
import type { Match } from "@/lib/providers/types";

/**
 * The season year to display for a competition RIGHT NOW — computed from today's
 * date, NOT from the provider.
 *
 * This must always resolve the live campaign and can never fail the table. Both
 * previous approaches relied on provider signals and both broke: the API `current`
 * flag sat on the just-finished season (Premier League showed last season), and
 * probing /standings for the "most recent populated" season fired a burst that
 * tripped the per-minute rate limit ("table not available"). Date math has none
 * of those failure modes — no API call, nothing to rate-limit, nothing to go
 * stale — and API-Football labels a season by its STARTING year, which is exactly
 * what this computes:
 *   • calendar-year competitions (MLS, World Cup): the current calendar year.
 *   • split-year competitions (European leagues, UEFA cups, Nations League,
 *     Aug–May): the current year from August onward, else the previous year.
 */
export function seasonYearFor(comp: CompetitionConst, now: Date = new Date()): number {
  const year = now.getUTCFullYear();
  const calendarYear = comp.country === "USA" || comp.slug === "world-cup";
  if (calendarYear) return year;
  return now.getUTCMonth() >= 7 ? year : year - 1; // 7 = August (0-indexed)
}

/** Async wrapper so existing `await` / `.then()` call sites keep working. */
export async function currentSeasonYear(comp: CompetitionConst): Promise<number> {
  return seasonYearFor(comp);
}

/**
 * Which competition's table to show by default: the one with games being played
 * (or played today), highest-priority first — so the home/calendar Top Table
 * tracks whatever's live, unless the user picks another. Only competitions that
 * actually have a standings table are eligible (the World Cup is a bracket).
 */
const TABLE_PRIORITY = [
  "premier-league",
  "la-liga",
  "serie-a",
  "bundesliga",
  "ligue-1",
  "mls",
  "nations-league",
  "champions-league",
  "europa-league",
];

export function pickActiveTableSlug(matches: Match[], fallback = "premier-league"): string {
  const today = todayKey();
  const live = new Set<string>();
  const todaySet = new Set<string>();
  for (const m of matches) {
    const slug = getCompetitionByLeagueId(m.competitionId)?.slug;
    if (!slug) continue;
    if (m.status === "live" || m.status === "ht") live.add(slug);
    else if (m.kickoffUtc.slice(0, 10) === today) todaySet.add(slug);
  }
  return (
    TABLE_PRIORITY.find((s) => live.has(s)) ??
    TABLE_PRIORITY.find((s) => todaySet.has(s)) ??
    fallback
  );
}
