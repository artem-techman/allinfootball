import "server-only";
import { provider } from "@/lib/providers";
import { getCompetitionByLeagueId, type CompetitionConst } from "@/lib/constants/competitions";
import { todayKey } from "@/lib/utils/date";
import type { Match } from "@/lib/providers/types";

/**
 * The season year to display for a competition RIGHT NOW.
 *
 * MUST always resolve the live campaign, never last season, and never fail the
 * table. It's a single cached call to getCurrentSeason — which picks the season
 * whose date range contains today (robust against a stale `current` flag). We do
 * NOT probe /standings here: that earlier made the resolver fire a burst of calls
 * that tripped the per-minute rate limit ("table not available") and could fall
 * back to last season. Cached 24h; standings themselves refresh on their own TTL.
 */
export async function currentSeasonYear(comp: CompetitionConst): Promise<number> {
  const season = await provider.getCurrentSeason(comp.leagueId).catch(() => undefined);
  return season?.year ?? comp.defaultSeason;
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
