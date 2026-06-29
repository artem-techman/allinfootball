import "server-only";
import { provider } from "@/lib/providers";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
import type { Match } from "@/lib/providers/types";
import type { BracketRound } from "@/components/cards/WorldCupBracket";

/**
 * Shared World Cup knockout-bracket data loader. Used by BOTH the home dashboard
 * and the competition Table tab so the two render the exact same widget. Returns
 * [] (→ the caller's demo-bracket fallback) before the knockout stage exists or
 * on any failure.
 */

const WORLD_CUP_SLUG = "world-cup";

/** Knockout-round ordering, outermost → Final. */
export const KO_ORDER = ["Round of 32", "Round of 16", "Quarter-finals", "Semi-finals", "Final"];

/** Map a raw API round string onto one of our bracket rounds, or null if it's a
 *  group-stage match (or the third-place play-off, which sits outside the tree). */
export function knockoutRound(round?: string): string | null {
  if (!round) return null;
  const r = round.toLowerCase();
  if (r.includes("3rd place") || r.includes("third place")) return null;
  if (r.includes("round of 32")) return "Round of 32";
  if (r.includes("round of 16") || r.includes("8th finals")) return "Round of 16";
  if (r.includes("quarter")) return "Quarter-finals";
  if (r.includes("semi")) return "Semi-finals";
  if (r.includes("final")) return "Final";
  return null;
}

/** The World Cup knockout bracket, grouped by round (outermost → Final). One
 *  cached fixtures-by-league call; returns [] before the knockout stage exists
 *  or on any failure. */
export async function loadWorldCupBracket(): Promise<BracketRound[]> {
  const wc = getCompetitionBySlug(WORLD_CUP_SLUG);
  if (!wc) return [];
  try {
    const fixtures = await provider.getFixturesByLeague(wc.leagueId, wc.defaultSeason);
    const byRound = new Map<string, Match[]>();
    for (const m of fixtures) {
      const name = knockoutRound(m.round);
      if (!name) continue;
      (byRound.get(name) ?? byRound.set(name, []).get(name)!).push(m);
    }
    return KO_ORDER.filter((name) => byRound.has(name)).map((name) => ({
      name,
      matches: byRound.get(name)!.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc)),
    }));
  } catch {
    return [];
  }
}
