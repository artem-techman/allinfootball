import "server-only";
import { provider } from "@/lib/providers";
import { swr, TTL } from "@/lib/cache";
import type { CompetitionConst } from "@/lib/constants/competitions";

/**
 * The season year to display for a competition RIGHT NOW.
 *
 * The app must not be pinned to a hard-coded season (it silently showed last
 * season's tables once the new campaigns kicked off). This resolves the season
 * API-Football itself flags as `current`, then — for competitions that have a
 * league table — verifies that season actually has standings and falls back to
 * the most recent populated season. That matters at the turn of a season: e.g.
 * the Premier League's 2026/27 had no table yet (0 rows) while 2025/26 still
 * did, so the current flag alone would blank the widget.
 *
 * Resolution is cached 24h (TTL.competitions); the underlying /standings probes
 * reuse the same cache keys the pages hit, so this adds ~no extra quota.
 */
export async function currentSeasonYear(comp: CompetitionConst): Promise<number> {
  return swr(`season:effective:${comp.leagueId}`, TTL.competitions, async () => {
    const cur = await provider.getCurrentSeason(comp.leagueId).catch(() => undefined);
    const start = cur?.year ?? comp.defaultSeason;

    // International tournaments (World Cup) are driven off fixtures, and their
    // group tables appear and vanish by stage — trust the current flag.
    if (comp.type === "international") return start;

    // Leagues and cups have a standings table: prefer the newest season that
    // actually has one so a just-kicked-off season doesn't blank the table.
    const candidates = Array.from(new Set([start, comp.defaultSeason, start - 1]));
    for (const year of candidates) {
      const rows = await provider.getStandings(comp.leagueId, year).catch(() => []);
      if (rows.length > 0) return year;
    }
    return start;
  });
}
