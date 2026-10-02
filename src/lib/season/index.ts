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
  const splitYear = now.getUTCMonth() >= 7 ? year : year - 1; // 7 = August (0-indexed)
  // The World Cup runs every four years (2026, 2030, …): show the latest edition
  // until the next one, never an empty future year (it went blank on 2027-01-01).
  if (comp.slug === "world-cup") return year - (((year - 2026) % 4) + 4) % 4;
  // The Nations League starts in even years (2024, 2026, …) and runs to the
  // following June; odd-year autumns have no new edition.
  if (comp.slug === "nations-league") return splitYear - (((splitYear % 2) + 2) % 2);
  if (comp.country === "USA") return year;
  return splitYear;
}

/** The edition before the current one (last season's results, H2H context). */
export function previousSeasonYear(comp: CompetitionConst, now: Date = new Date()): number {
  const current = seasonYearFor(comp, now);
  if (comp.slug === "world-cup") return current - 4;
  if (comp.slug === "nations-league") return current - 2;
  return current - 1;
}

/** Seasons we serve for a competition: the current one and the one before. */
export function allowedSeasons(comp: CompetitionConst, now: Date = new Date()): number[] {
  return [seasonYearFor(comp, now), previousSeasonYear(comp, now)];
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
